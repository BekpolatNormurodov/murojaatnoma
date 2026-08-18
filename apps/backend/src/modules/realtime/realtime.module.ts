import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from '../chat/chat.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { IceController } from './ice.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Realtime lane: one Socket.IO gateway for live chat + WebRTC call signaling,
 * plus REST helpers (ICE servers, call history). Depends on ChatModule for
 * message persistence (ChatService) and on the global PushService for FCM
 * background call-push. JwtModule.register({}) provides a JwtService used only
 * to verify the handshake token (secret is passed explicitly per verify call,
 * mirroring auth.service).
 */
@Module({
  imports: [ChatModule, JwtModule.register({})],
  controllers: [IceController, CallsController],
  providers: [RealtimeGateway, RealtimeService, CallsService],
})
export class RealtimeModule {}
