import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

// T018: structured-ish logger used app-wide. Kept intentionally simple (extends Nest's built-in
// ConsoleLogger) — swap the transport here later (e.g. JSON/pino) without touching call sites.
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {}
