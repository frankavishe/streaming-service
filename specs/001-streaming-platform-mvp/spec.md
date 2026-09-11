# Feature Specification: Streaming Platform MVP

**Feature Branch**: `001-streaming-platform-mvp`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Build a subscription video streaming platform. Visitors can browse a catalog of movies and TV series (with seasons/episodes) and watch a short trailer for any title without an account. To watch a full movie or episode, a user must register, log in, and subscribe to the platform's single paid plan. A user starts a subscription by paying either via M-Pesa mobile money (STK push to their phone, with payment status polling) or via a bank payment gateway (card/bank transfer redirect flow). Once payment is confirmed, the subscription activates immediately and unlocks full playback; the subscription is time-boxed (e.g. 30 days) and must be renewed to stay active. Subscribers can view their billing/payment history and see their subscription status. Admins can upload video content (a trailer and a full video per title), which is transcoded into adaptive-bitrate HLS for playback, and manage title metadata (name, description, poster, genres, and whether it's a movie or a series with seasons/episodes)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Catalog and Watch Trailers (Priority: P1)

A visitor, with no account, opens the site, browses a catalog of movies and TV series, opens a title's detail page, and watches its trailer/preview clip.

**Why this priority**: This is the storefront — it is what lets a visitor discover the product's value and decide to pay for it. Without it there is no funnel into a subscription at all.

**Independent Test**: Can be fully tested by visiting the site with no account, browsing the catalog, opening any title, and playing its trailer to completion — delivers standalone value (content discovery) even before any payment feature exists.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they open the site, **Then** they see a catalog of published titles (movies and series) with poster art and basic info.
2. **Given** a visitor viewing a title's detail page, **When** they press play, **Then** the trailer/preview plays without being prompted to log in or pay.
3. **Given** a visitor viewing a series title, **When** they open it, **Then** they can see its seasons and episodes listed, and can play any episode's trailer.
4. **Given** a visitor attempts to play the full movie/episode (not the trailer) directly, **When** the request is made, **Then** it is refused and they are prompted to register/log in and subscribe.

---

### User Story 2 - Subscribe and Unlock Full Playback (Priority: P1)

A registered, logged-in user without an active subscription chooses to subscribe, pays via M-Pesa mobile money or via the bank payment gateway, and — once payment is confirmed — can immediately watch full movies and episodes.

**Why this priority**: This is the platform's only revenue mechanism and the core value unlock for the user; it is the product's reason to exist.

**Independent Test**: Can be fully tested end-to-end by registering an account, initiating a subscription payment through either payment method, confirming the payment, and then successfully playing a full movie/episode that was previously trailer-only — delivers the core monetized value independently of catalog browsing polish.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no active subscription, **When** they choose "Subscribe" and select M-Pesa, **Then** they are prompted for a phone number and an STK push payment prompt is sent to that phone.
2. **Given** an STK push has been sent, **When** the user completes or cancels it on their phone, **Then** the site reflects the resulting payment status (success/failure/timeout) without the user needing to manually refresh indefinitely.
3. **Given** a logged-in user with no active subscription, **When** they choose "Subscribe" and select bank payment, **Then** they are redirected to complete a card/bank-transfer payment and returned to the site afterward with the outcome shown.
4. **Given** a payment (either method) completes successfully, **When** the platform receives confirmation, **Then** the user's subscription becomes active immediately and they can play any full movie/episode without further action.
5. **Given** a payment fails, is canceled, or times out, **When** the user returns to the site, **Then** they see a clear failure state and can retry, and no subscription is activated.
6. **Given** a user's subscription has expired, **When** they try to play a full movie/episode, **Then** playback is refused and they are prompted to renew.

---

### User Story 3 - View Subscription Status and Billing History (Priority: P2)

A logged-in subscriber checks their account area to see whether their subscription is active, when it expires/renews, and their past payments.

**Why this priority**: Builds trust and reduces support burden (users can self-serve "why can't I watch?" and "was I charged?" questions), but the platform is usable end-to-end without it.

**Independent Test**: Can be fully tested by logging in as a user with at least one past payment and confirming the account page shows accurate current status and a list of past transactions with date, amount, method, and outcome.

**Acceptance Scenarios**:

1. **Given** a logged-in subscriber, **When** they open their account/billing page, **Then** they see whether their subscription is currently active and its expiry/renewal date.
2. **Given** a logged-in user with past payment attempts, **When** they open their billing history, **Then** they see each attempt with date, amount, payment method, and outcome (success/failed).

---

### User Story 4 - Manage Content Catalog (Priority: P2)

An admin adds a new title (movie, or series with seasons and episodes), uploading a trailer and full video for each watchable unit, and sets its metadata so it becomes visible in the public catalog.

**Why this priority**: Without an operator-facing way to add content, the catalog is permanently empty; but the platform can launch with an initial catalog seeded manually, so this is not required for the first end-to-end demo of the subscribe-and-watch flow.

**Independent Test**: Can be fully tested by logging in as an admin, creating a new movie title with a trailer and full video upload and metadata, and confirming it becomes visible to visitors in the public catalog once published.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they create a new movie title with a trailer, a full video, and metadata (name, description, poster, genres), **Then** the title becomes visible in the public catalog once published.
2. **Given** an admin, **When** they create a new series title and add seasons and episodes (each with its own trailer and full video), **Then** visitors can browse those seasons/episodes and play each episode's trailer.
3. **Given** an admin uploads a full video, **When** processing completes, **Then** the video is available for adaptive-quality playback to subscribers; until processing completes, the title is not shown as playable.
4. **Given** an admin edits an existing title's metadata, **When** they save changes, **Then** the public catalog reflects the update.

---

### Edge Cases

- What happens when a payment webhook/callback arrives twice for the same transaction (duplicate delivery)? The subscription MUST NOT be extended or double-activated as a result.
- What happens when a user's subscription expires while they are mid-playback of a full video? Playback of already-loaded content MAY continue to the end of the current session, but any new playback request MUST be refused until renewal.
- What happens when an M-Pesa STK push is sent but the user never responds on their phone? The attempt MUST eventually be marked as timed out rather than left pending forever, and the user MUST be able to retry.
- What happens if someone who is not logged in, or is logged in but unsubscribed, tries to access a full-video URL directly (not through the site's UI)? Access MUST be refused server-side regardless of how the request was made.
- What happens when an uploaded video fails to transcode? The admin MUST be shown a clear failure state for that asset, and the title MUST NOT appear playable to end users until a valid asset exists.
- What happens when a user tries to subscribe while a previous subscription payment from them is still pending? The system MUST prevent starting a conflicting duplicate payment for the same user until the prior attempt resolves (succeeds, fails, or times out).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow any visitor, without an account, to browse the catalog of published movies and series and view each title's metadata (name, description, poster, genres).
- **FR-002**: System MUST allow any visitor, without an account, to play the trailer/preview of any published title (or, for a series, any published episode).
- **FR-003**: System MUST NOT allow playback of a full movie or episode (as opposed to its trailer) to anyone who is not logged in.
- **FR-004**: System MUST allow a visitor to register an account and log in.
- **FR-005**: System MUST NOT allow playback of a full movie or episode to a logged-in user who does not currently have an active subscription.
- **FR-006**: System MUST let a logged-in user initiate a subscription payment via M-Pesa mobile money (phone-number-based push payment).
- **FR-007**: System MUST let a logged-in user initiate a subscription payment via a bank payment gateway (card and/or bank transfer).
- **FR-008**: System MUST verify that a payment completion notification genuinely came from the payment provider before treating it as valid.
- **FR-009**: System MUST activate a user's subscription only after a payment for it is confirmed as successful, and MUST do so without requiring further manual action from the user.
- **FR-010**: System MUST process each payment confirmation exactly once in its effect, even if the provider delivers the same confirmation more than once.
- **FR-011**: System MUST show the user the current status of an in-progress payment (pending, succeeded, failed, timed out) without requiring indefinite manual polling by the user.
- **FR-012**: System MUST expire a subscription automatically after its paid period (e.g. 30 days) elapses, at which point full-playback access is revoked until the user pays again.
- **FR-013**: System MUST let a logged-in subscriber view their current subscription status and its expiry/renewal date.
- **FR-014**: System MUST let a logged-in user view a history of their past payment attempts, each showing date, amount, method, and outcome.
- **FR-015**: System MUST let an admin create, edit, and publish/unpublish a title as either a movie or a series containing seasons and episodes.
- **FR-016**: System MUST let an admin upload a trailer video and a full video for each watchable unit (a movie, or an episode).
- **FR-017**: System MUST process an uploaded full video into a form suitable for adaptive-quality streaming before it is offered for subscriber playback.
- **FR-018**: System MUST NOT list a title/episode as playable in the catalog until its required video asset(s) have finished processing successfully.
- **FR-019**: System MUST restrict content-management actions (creating/editing/publishing titles, uploading video) to admin users only.
- **FR-020**: System MUST record every payment attempt (including failed/timed-out ones) so it can be shown in billing history and audited.

### Key Entities

- **User**: A person with an account; has credentials, a role (regular user or admin), and, if a subscriber, a link to their current/most recent subscription.
- **Subscription**: A user's paid access grant; has a status (active, expired), a start date, and an expiry/renewal date. In v1 there is a single plan (one price, full catalog access).
- **Payment (Transaction)**: A record of one payment attempt tied to a user and (on success) a subscription; has an amount, a method (M-Pesa or bank gateway), a status (pending, succeeded, failed, timed out), and a timestamp.
- **Title**: A piece of content in the catalog — either a movie or a series; has a name, description, poster image, genres, and a published/unpublished state.
- **Season**: Belongs to a series title; groups episodes.
- **Episode**: Belongs to a season; is itself a watchable unit like a movie (has its own trailer and full video).
- **Media Asset**: The trailer or full video belonging to a movie or episode; has a processing state (pending, ready, failed) and, once ready, is the thing actually streamed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can find a title and start playing its trailer within 3 clicks/taps from the homepage, with no account required.
- **SC-002**: A logged-in user can go from choosing "Subscribe" to successfully starting playback of a full movie/episode in under 5 minutes for a successful payment, including payment confirmation time.
- **SC-003**: 100% of attempts to play full (non-trailer) content by a visitor without an account, or by a logged-in user without an active subscription, are blocked.
- **SC-004**: A subscriber can determine their subscription status and expiry/renewal date within 3 seconds of opening their account/billing page.
- **SC-005**: An admin can take a new title from creation to appearing as playable in the public catalog without requiring engineering/developer assistance.
- **SC-006**: A user who initiates an M-Pesa payment sees a final outcome (success, failure, or timeout) reflected on the site within 60 seconds of completing or abandoning the action on their phone.
- **SC-007**: No duplicate payment-provider notification ever results in a subscription being extended or activated more than the single payment it represents warrants.

## Assumptions

- Subscription renewal in v1 is manual: when a subscription expires, the user initiates and pays for a new subscription period themselves; automatic recurring billing/re-charging is out of scope for v1.
- A single subscription plan exists (one price, full catalog access); multi-tier plans are out of scope for v1.
- A single currency is used for pricing and payments in v1, matching the primary market for the M-Pesa integration.
- There is one "admin" role with full content-management permissions in v1; finer-grained admin roles (e.g. content editor vs. billing admin) are out of scope.
- No free trial period exists in v1 — non-subscribers always see trailer-only access, with no time-limited full-content preview.
- No refunds/proration are offered in v1; a subscription runs for the period paid for.
- Simultaneous-stream/device limits per account are not enforced in v1.
- Visitors and users have a stable internet connection sufficient for adaptive-bitrate video streaming.
