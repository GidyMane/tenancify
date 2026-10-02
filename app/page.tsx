import { AuthGate } from '@/components/auth-gate'
import { RentwiseDashboard } from '@/components/rentwise-dashboard'
import {getKindeServerSession} from "@kinde-oss/kinde-auth-nextjs/server";




export default async function Page() {

  const {getAccessTokenRaw} = getKindeServerSession();
  const token = await getAccessTokenRaw();


  console.log("Token from server session:", token);


  return (
    <AuthGate>
      <RentwiseDashboard />
    </AuthGate>
  )
}

export const dynamic = 'force-dynamic'



