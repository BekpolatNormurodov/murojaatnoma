import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { PushService } from './push.service';

/**
 * Employee-facing push registration (mobile worker-app). The device registers
 * its FCM token after login so the backend can deliver push notifications
 * (e.g. the "location went silent" alert), and unregisters it on logout.
 */
@ApiTags('push')
@ApiBearerAuth()
@RequireScope('employee')
@Controller('notifications/device-token')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register this device FCM token for push' })
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    await this.pushService.registerToken(user.employeeId, dto.token, dto.platform);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister an FCM token (on logout)' })
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    await this.pushService.unregisterToken(user.employeeId, dto.token);
  }
}
