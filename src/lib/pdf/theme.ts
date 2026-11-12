import { StyleSheet } from "@react-pdf/renderer";

export const C = { navy: "#102D50", blue: "#087DC5", orange: "#F28A00", ink: "#333B45", grey: "#6B7480", line: "#DDE2E8", canvas: "#F4F6F8" };

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, lineHeight: 1.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  logo: { width: 150, height: 31 },
  issuer: { textAlign: "right", fontSize: 8.5, color: C.grey },
  issuerName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 2 },
  title: { fontSize: 20, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 10, color: C.grey, marginBottom: 16 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  box: { width: "48%" },
  label: { fontSize: 7.5, color: C.grey, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { borderTopWidth: 1, borderTopColor: C.navy, marginTop: 6 },
  th: { flexDirection: "row", backgroundColor: C.canvas, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.navy },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5 },
  cell: { paddingHorizontal: 4 },
  right: { textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.navy, marginTop: 4, paddingTop: 5, fontFamily: "Helvetica-Bold", fontSize: 11, color: C.navy },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 4 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 26, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.grey, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: C.orange },
  watermark: { position: "absolute", top: 330, left: 90, fontSize: 90, color: "#EEF1F5", transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
  note: { fontSize: 8.5, color: C.grey, marginTop: 4 },
});
