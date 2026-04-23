export type TicketStatus = "open" | "in_progress" | "waiting_parts" | "resolved" | "closed";

export interface TicketListItem {
  id: string;
  ticket_no: string;
  title: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high" | "critical" | null;
  created_at: string;
  customer_name: string | null;
  machine_name: string | null;
}
