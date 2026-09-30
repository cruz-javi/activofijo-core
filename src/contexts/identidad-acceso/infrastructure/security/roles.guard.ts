import { Injectable, Inject, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no requiere roles ni permisos específicos, permitir acceso
    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Identidad de usuario no encontrada');
    }

    // Normalizar roles del usuario (soporta array de roles o string único)
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: string) => r.toUpperCase())
      : user.rol
        ? [user.rol.toUpperCase()]
        : [];

    const userPermisos: string[] = Array.isArray(user.permisos) ? user.permisos : [];

    // El Administrador del Sistema posee acceso irrestricto
    const isGlobalAdmin = userRoles.includes('ADMINISTRADOR') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN');
    if (isGlobalAdmin) {
      return true;
    }

    // Si se especifican tanto roles como permisos, permitir acceso si cumple con alguno de los dos
    const hasRoleCheck = requiredRoles && requiredRoles.length > 0;
    const hasPermCheck = requiredPermissions && requiredPermissions.length > 0;

    if (hasRoleCheck && hasPermCheck) {
      const matchesRole = requiredRoles.some((reqRole) => userRoles.includes(reqRole.toUpperCase()));
      const matchesPerm = requiredPermissions.some((reqPerm) => userPermisos.includes(reqPerm));
      if (!matchesRole && !matchesPerm) {
        throw new ForbiddenException('No cuenta con el rol ni con el permiso requerido para esta operación');
      }
      return true;
    }

    // Validar roles si están definidos exclusivamente
    if (hasRoleCheck) {
      const hasRequiredRole = requiredRoles.some((reqRole) =>
        userRoles.includes(reqRole.toUpperCase())
      );
      if (!hasRequiredRole) {
        throw new ForbiddenException('Su rol institucional no posee autorización para esta operación');
      }
    }

    // Validar permisos granulares si están definidos exclusivamente
    if (hasPermCheck) {
      const hasRequiredPermission = requiredPermissions.some((reqPerm) =>
        userPermisos.includes(reqPerm)
      );
      if (!hasRequiredPermission) {
        throw new ForbiddenException('No cuenta con el permiso específico requerido para esta acción');
      }
    }

    return true;
  }
}
