import { gatePage } from "@/lib/gate";
import Grading from "@/components/Grading";

export default async function GradingPage() {
  await gatePage(["superAdmin", "studentLeader"], { path: "/grading" });
  return <Grading />;
}
