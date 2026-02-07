import { redirect } from "next/navigation";

const isStaticMode = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';

export default function Home() {
  if (isStaticMode) {
    redirect("/teleprompter");
  } else {
    redirect("/open");
  }
}
