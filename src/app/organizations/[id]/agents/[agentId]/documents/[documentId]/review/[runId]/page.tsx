import Link from 'next/link';
import {redirect} from 'next/navigation';
import {SignOutButton} from '@clerk/nextjs';
import {getOrganizationAccess} from '@/lib/organization-access';
import {findOrganization} from '@/lib/organization-data';
import {findAgent} from '@/lib/agent-data';
import {isUuid} from '@/lib/agents';
import {DocumentReview} from './document-review';
export default async function ReviewPage({params}:{params:Promise<{id:string;agentId:string;documentId:string;runId:string}>}){
 const access=await getOrganizationAccess();
 if('error' in access){if(access.status===401)redirect('/sign-in');return <Denied/>;}
 const {id,agentId,documentId,runId}=await params;
 if(![id,agentId,documentId,runId].every(isUuid))return <Denied/>;
 const org=await findOrganization(access.supabase,access.userId,id);
 if(org.error||!org.data)return <Denied/>;
 const agent=await findAgent(access.supabase,id,agentId);
 if(agent.error||!agent.data)return <Denied/>;
 // The API repeats full authorization and version/source validation before serving evidence.
 return <DocumentReview key={runId} organizationId={id} agentId={agentId} documentId={documentId} runId={runId}/>;
}
function Denied(){return <main className="space-y-4 p-6"><p role="alert">Não foi possível abrir esta revisão com sua conta. Volte aos documentos ou entre com outra conta autorizada.</p><Link href="/organizations" className="underline">Voltar às organizações</Link><SignOutButton redirectUrl="/sign-in"><button>Sair e trocar de conta</button></SignOutButton></main>;}
