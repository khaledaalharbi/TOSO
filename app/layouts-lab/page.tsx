import type { Metadata } from "next";
import { LayoutsLab } from "./layouts-lab";

export const metadata: Metadata = {
  title: "مختبر التخطيطات — TOSO",
  description: "نماذج تخطيط مرئية لمواضع الحاويات في واجهة TOSO",
};

/** Isolated prototype route — not linked from the app; wireframes only. */
export default function Page() {
  return <LayoutsLab />;
}
