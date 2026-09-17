import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import MessagingSettings from "@/features/hospitalAuth/MessagingSettings";

/**
 * The platform's own SMS gateway.
 *
 * One set of credentials, entered once, that every hospital without its own
 * falls back to. The same component as the tenant settings tab, pointed at the
 * platform endpoints - the decisions are identical, and only the scope differs.
 */
export default function PlatformMessaging() {
  return (
    <PageContainer>
      <PageHeader
        title="Messaging"
        subtitle="The gateway and message text every hospital falls back to"
      />
      <MessagingSettings base="/platform-messaging" />
    </PageContainer>
  );
}
