import { CheckInDto } from './check-in.dto';

/** Same payload shape as check-in: face score + GPS coordinates. */
export class CheckOutDto extends CheckInDto {}
