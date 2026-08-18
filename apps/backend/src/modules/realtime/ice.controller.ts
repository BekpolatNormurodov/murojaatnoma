import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfig } from '../../common/config/configuration';
import { Public } from '../../common/decorators/public.decorator';

interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

/**
 * Serves the WebRTC ICE server list so clients never hardcode it — TURN can be
 * added server-side (env) later with no client rebuild. STUN is always present.
 */
@ApiTags('realtime')
@Controller('rt')
export class IceController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Public()
  @Get('ice-servers')
  @ApiOperation({ summary: "WebRTC ICE serverlari (STUN + ixtiyoriy TURN)" })
  iceServers(): { iceServers: IceServer[] } {
    const rt = this.config.get('realtime', { infer: true });
    const iceServers: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (rt.turnUrl) {
      iceServers.push({
        urls: rt.turnUrl,
        username: rt.turnUsername,
        credential: rt.turnCredential,
      });
    }
    return { iceServers };
  }
}
