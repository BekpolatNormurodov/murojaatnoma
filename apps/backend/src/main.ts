import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);
  const { port } = configService.get('app', { infer: true });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hokimiyat tizimi API')
    .setDescription(
      'Backend API for the government employee-management ecosystem: auth, employees (Xodim), attendance (Davomat), citizen applications (Murojaat/Ariza), and notifications.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);
  Logger.log(`Application listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
