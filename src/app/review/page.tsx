import { redirect } from "next/navigation";

/** Backward-compatible entry: reviews now run through the focused Daily Session. */
export default function ReviewPage() {
  redirect("/study/daily");
}
