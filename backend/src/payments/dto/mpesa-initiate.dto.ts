import { Matches } from 'class-validator';

// Accepts 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, or 2541XXXXXXXX Kenyan MSISDN formats.
export class MpesaInitiateDto {
  @Matches(/^(?:254|0)(7|1)\d{8}$/, {
    message: 'phoneNumber must be a valid Kenyan MSISDN, e.g. 0712345678 or 254712345678',
  })
  phoneNumber!: string;
}
