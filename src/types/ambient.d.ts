/* eslint-disable @typescript-eslint/no-explicit-any */
// Ambient type declarations for server workspace dependencies and test framework

declare module 'express' {
  export interface Request {
    headers: any;
    body: any;
    params: any;
    query: any;
    [key: string]: any;
  }
  export interface Response {
    status(code: number): this;
    json(body?: any): this;
    send(body?: any): this;
    [key: string]: any;
  }
  export type NextFunction = (err?: any) => void;
  export interface Application {
    use(...args: any[]): this;
    get(...args: any[]): this;
    post(...args: any[]): this;
    put(...args: any[]): this;
    delete(...args: any[]): this;
    listen(...args: any[]): any;
  }
  export interface Router {
    use(...args: any[]): this;
    get(...args: any[]): this;
    post(...args: any[]): this;
    put(...args: any[]): this;
    delete(...args: any[]): this;
  }
  export function Router(): Router;
  const express: {
    (): Application;
    json(): any;
    urlencoded(options?: any): any;
    Router: typeof Router;
  };
  export default express;
}

declare module 'cors' {
  const cors: any;
  export default cors;
}

declare module 'dotenv' {
  export function config(options?: any): any;
}

declare module 'morgan' {
  const morgan: any;
  export default morgan;
}

declare module 'helmet' {
  const helmet: any;
  export default helmet;
}

declare module 'swagger-ui-express' {
  const swaggerUi: any;
  export default swaggerUi;
}

declare module 'swagger-jsdoc' {
  export interface Options {
    definition: any;
    apis: string[];
  }
  const swaggerJSDoc: (options: Options) => any;
  export default swaggerJSDoc;
}

declare module 'supertest' {
  const request: any;
  export default request;
}

declare module 'socket.io' {
  export class Server {
    constructor(srv?: any, opts?: any);
    on(event: string, fn: (socket: any) => void): this;
    emit(event: string, ...args: any[]): this;
  }
  export class Socket {
    id: string;
    on(event: string, fn: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
  }
}

declare module 'bcryptjs' {
  export function hash(s: string, salt: number | string): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secretOrPrivateKey: string, options?: any): string;
  export function verify(token: string, secretOrPublicKey: string, options?: any): any;
}

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    user: any;
    refreshToken: any;
    passwordResetToken: any;
    $disconnect(): Promise<any>;
  }
  export interface User {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    passwordHash: string;
    role: string;
    status: string;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
}

declare module 'zod' {
  export const z: any;
  export type infer<T> = any;
  export type AnyZodObject = any;
  export type ZodSchema<T = any> = any;
  export class ZodError extends Error {
    errors: any[];
  }
}

// Jest testing globals
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: any): any;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
