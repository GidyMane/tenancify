// Kinde's sign-in routes: /api/auth/login, /api/auth/logout, /api/auth/register and /api/auth/kinde_callback.
import { handleAuth } from '@kinde-oss/kinde-auth-nextjs/server'

export const GET = handleAuth()
