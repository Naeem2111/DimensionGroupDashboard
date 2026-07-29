# n8n Lead Outreach – Visual Flow (cPanel SMTP)

**Workflow:** Dimension Group Lead Outreach – cPanel SMTP  
**Import:** `n8n-lead-outreach-workflow.json`

```mermaid
flowchart LR
  A[ManualTrigger] --> B[FetchLeads]
  B --> C[MapFields]
  C --> S[SwitchStage]
  S -->|cold_targeted| E1[SMTP_Cold]
  S -->|first_email_follow_due| E4[SMTP_FollowUp]
  S -->|positive_interested| E2[SMTP_BookCall]
  S -->|negative_not_interested| E3[SMTP_ThankYou]
  E1 --> R1[ReportDashboard]
  E2 --> R2[ReportDashboard]
  E3 --> R3[ReportDashboard]
  E4 --> R4[ReportDashboard]
```

## Stage → email

| Switch | SMTP node | Dashboard after send |
|--------|-----------|----------------------|
| cold, targeted | Send Cold Email | `first_email_sent` |
| first_email_sent, follow_up_due | Send Follow-Up | `follow_up_sent` |
| positive_reply, interested | Send Book Call | note only |
| negative_reply, not_interested | Send Thank You | note only |

Mail transport: **cPanel SMTP** (`mail.dimensiongroupglobal.com`), not Gmail.
