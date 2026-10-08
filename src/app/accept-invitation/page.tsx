import { auth, clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAdminInvitationReference,
  isVerifiedInvitationEmailMatch,
} from "@/lib/admin-invitation-acceptance";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { SignOutButton } from "@/app/sign-out-button";

function InvitationMessage({
  children,
  allowAccountSwitch = true,
}: {
  children: string;
  allowAccountSwitch?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-10 dark:bg-black">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Convite de administrador</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">Não foi possível concluir o acesso</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{children}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            href="/"
          >
            Voltar à plataforma
          </Link>
          {allowAccountSwitch ? (
            <SignOutButton label="Sair e tentar outra conta" />
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default async function AcceptInvitationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const invitationRef = getAdminInvitationReference(user.publicMetadata);
  const primaryEmail = user.primaryEmailAddress;

  if (!invitationRef || !primaryEmail) {
    return (
      <InvitationMessage allowAccountSwitch>
        Esta conta não tem um convite válido associado. Saia, reabra o link original e entre com o e-mail que recebeu o convite.
      </InvitationMessage>
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleSupabaseClient();
  } catch {
    return (
      <InvitationMessage>
        Não conseguimos concluir seu acesso agora. Tente novamente mais tarde. Se o problema continuar, avise quem enviou o convite.
      </InvitationMessage>
    );
  }

  const { data: invitation, error: lookupError } = await supabase
    .from("admin_invitations")
    .select("id, email_address, status, accepted_by_clerk_user_id")
    .eq("id", invitationRef)
    .maybeSingle();

  if (lookupError || !invitation) {
    return (
      <InvitationMessage>
        O convite não foi encontrado. Peça ao owner para verificar o envio ou criar um novo convite.
      </InvitationMessage>
    );
  }

  if (
    !isVerifiedInvitationEmailMatch(
      invitation.email_address,
      primaryEmail.emailAddress,
      primaryEmail.verification?.status,
    )
  ) {
    return (
      <InvitationMessage allowAccountSwitch>
        O e-mail verificado desta conta não corresponde ao endereço convidado. Saia, reabra o link original e entre com o e-mail convidado.
      </InvitationMessage>
    );
  }

  if (invitation.status === "accepted" && invitation.accepted_by_clerk_user_id === userId) {
    redirect("/");
  }

  if (invitation.status !== "pending") {
    return (
      <InvitationMessage>
        Este convite foi cancelado, expirou ou já foi utilizado por outra conta. Peça ao owner para enviar um novo.
      </InvitationMessage>
    );
  }

  const { data: accepted, error: acceptError } = await supabase.rpc(
    "admin_invitation_accept",
    {
      p_invitation_ref: invitationRef,
      p_clerk_user_id: userId,
      p_email_address: primaryEmail.emailAddress,
    },
  );

  if (acceptError || accepted !== true) {
    return (
      <InvitationMessage>
        Não foi possível ativar seu acesso. O convite pode ter expirado ou já ter sido utilizado; peça ao owner para revisar.
      </InvitationMessage>
    );
  }

  redirect("/");
}
