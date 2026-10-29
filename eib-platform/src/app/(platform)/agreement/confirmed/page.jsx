// Where the guardian lands after clicking the emailed link. Public: no
// sign-in. The state comes from the confirm route's redirect.
import ConfirmResult from "@/components/ConfirmResult";

export const metadata = { title: "Student Agreement · confirmation" };

export default async function ConfirmedPage({ searchParams }) {
  const params = await searchParams;
  const state = ["ok", "used", "expired", "invalid"].includes(params?.state) ? params.state : "invalid";
  const student = typeof params?.student === "string" ? params.student : "";
  const token = typeof params?.token === "string" ? params.token : "";
  return <ConfirmResult state={state} student={student} token={token} />;
}
