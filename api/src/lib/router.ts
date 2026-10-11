import type { Env } from '../env'
import { ApiError } from './http'

export interface RouteContext {
  req: Request
  env: Env
  ctx: ExecutionContext
  url: URL
  params: Record<string, string>
  userId: string
}

export type RouteHandler = (context: RouteContext) => Promise<Response>

interface Route {
  method: string
  segments: string[]
  handler: RouteHandler
  public: boolean
}

export interface RouterOptions {
  /** Resuelve el usuario de la sesión. Solo se llama en rutas privadas. */
  authenticate: (req: Request, env: Env) => Promise<string>
}

export function createRouter(options: RouterOptions) {
  const routes: Route[] = []

  function route(method: string, path: string, publicRoute: boolean, handler: RouteHandler) {
    routes.push({ method, segments: path.split('/').filter(Boolean), handler, public: publicRoute })
  }

  return {
    get: (path: string, handler: RouteHandler) => route('GET', path, false, handler),
    post: (path: string, handler: RouteHandler) => route('POST', path, false, handler),
    put: (path: string, handler: RouteHandler) => route('PUT', path, false, handler),
    publicGet: (path: string, handler: RouteHandler) => route('GET', path, true, handler),
    publicPost: (path: string, handler: RouteHandler) => route('POST', path, true, handler),

    /** Devuelve la ruta que coincide, o null si ninguna aplica. */
    match(method: string, pathname: string) {
      const parts = pathname.split('/').filter(Boolean)
      for (const candidate of routes) {
        if (candidate.method !== method) continue
        if (candidate.segments.length !== parts.length) continue
        const params: Record<string, string> = {}
        let matches = true
        for (let i = 0; i < candidate.segments.length; i += 1) {
          const segment = candidate.segments[i] as string
          const part = parts[i] as string
          if (segment.startsWith(':')) {
            params[segment.slice(1)] = decodeURIComponent(part)
          } else if (segment !== part) {
            matches = false
            break
          }
        }
        if (matches) return { route: candidate, params }
      }
      return null
    },

    async handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(req.url)
      const found = this.match(req.method, url.pathname)
      if (!found) {
        throw new ApiError(404, 'not_found', `No existe ${req.method} ${url.pathname}.`)
      }
      const userId = found.route.public ? '' : await options.authenticate(req, env)
      return found.route.handler({ req, env, ctx, url, params: found.params, userId })
    },
  }
}
