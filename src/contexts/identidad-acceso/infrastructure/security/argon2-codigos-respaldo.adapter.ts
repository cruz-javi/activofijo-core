import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import crypto from 'crypto';
import { CodigosRespaldoPort, CodigosRespaldoGenerados } from '../../domain/ports/codigos-respaldo.port.js';

// Sin 0/O/1/I/L para evitar errores al transcribir el código impreso.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GRUPOS = 3;
const LONGITUD_GRUPO = 4;
const CANTIDAD_POR_DEFECTO = 10;

@Injectable()
export class Argon2CodigosRespaldoAdapter implements CodigosRespaldoPort {
  async generar(cantidad = CANTIDAD_POR_DEFECTO): Promise<CodigosRespaldoGenerados> {
    const codigosPlano = Array.from({ length: cantidad }, () => this.generarCodigo());
    const hashes = await Promise.all(codigosPlano.map((codigo) => argon2.hash(this.normalizar(codigo))));
    return { codigosPlano, hashes };
  }

  async verificar(codigoIngresado: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, this.normalizar(codigoIngresado));
  }

  private normalizar(codigo: string): string {
    return codigo.replace(/-/g, '').trim().toUpperCase();
  }

  private generarCodigo(): string {
    const grupos = Array.from({ length: GRUPOS }, () =>
      Array.from({ length: LONGITUD_GRUPO }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join(''),
    );
    return grupos.join('-');
  }
}
