import { redirect } from "next/navigation";

export default function AdminLandingRedirect() {
  redirect("/ho/overview");
}
