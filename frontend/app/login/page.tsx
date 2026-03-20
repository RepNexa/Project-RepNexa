import LoginPageClient from "./LoginPageClient";

type LoginPageProps = {
  searchParams?: {
    portal?: string | string[];
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const portal = Array.isArray(searchParams?.portal)
    ? (searchParams.portal[0] ?? "")
    : (searchParams?.portal ?? "");

  return <LoginPageClient portal={portal} />;
}