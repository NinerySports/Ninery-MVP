import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class PlayerDNAAuthorizationGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Development-only boundary. Replace with authenticated family membership checks before public launch.
    return true;
  }
}
