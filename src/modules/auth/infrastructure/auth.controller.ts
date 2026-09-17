import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  UsePipes,
  Req,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service.js';
import { LoginSchema, LoginDto, RefreshSchema, RefreshDto } from './auth.dto.js';
import { ZodValidationPipe } from '../../../infrastructure/http/pipes/zod-validation.pipe.js';
import { Public } from '../../../infrastructure/security/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password, body.deviceId);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken, body.deviceId);
  }

  @Public()
  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    return { success: true };
  }

  @Get('me')
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
