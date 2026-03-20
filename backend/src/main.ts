import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  // app.enableCors({
  //   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  //   credentials: true,
  // });
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://portal.clockchair.com',
    'https://www.clockchair.com',
   'https://www.clockchair.com,https://portal.clockchair.com,https://zatca-frontend.vercel.app'
  ],
  credentials: true,
});
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend server running on http://localhost:${port}`);
}

bootstrap();
