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
      // Bir xil TURN hostini HAM UDP, HAM TCP transport bilan e'lon qilamiz:
      // ba'zi mobil/korporativ tarmoqlar UDPni bloklaydi, TCP relay orqali
      // media baribir o'tadi. `?transport=...` allaqachon berilgan bo'lsa,
      // qiymatni o'zgartirmaymiz.
      const urls = rt.turnUrl.includes('?transport=')
        ? [rt.turnUrl]
        : [`${rt.turnUrl}?transport=udp`, `${rt.turnUrl}?transport=tcp`];
      for (const urlEntry of urls) {
        iceServers.push({
          urls: urlEntry,
          username: rt.turnUsername,
          credential: rt.turnCredential,
        });
      }
    }
    return { iceServers };
  }
}
