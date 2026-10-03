import type Elysia from "elysia";
import {
  getRecentDocuments,
  submitInvoices,
  cancelDocument,
  rejectDocument,
  searchDocuments,
  getDocumentDetails,
  getDocumentRaw,
  submitCreditNotes,
  submitDebitNotes,
  submitRefundNotes,
  submitSelfBilledInvoices,
  submitSelfBilledCreditNotes,
  submitSelfBilledDebitNotes,
  submitSelfBilledRefundNotes,
} from "./documents.service";
import {
  GetRecentDocumentsRequestQueryScheme,
  GetRecentDocumentsResponseSchema,
  SubmitInvoiceDocumentsQueryScheme,
  SubmitInvoiceDocumentsBodyScheme,
  CancelDocumentRequestQuerySchema,
  CancelDocumentRequestParamsSchema,
  RejectDocumentRequestParamsSchema,
  RejectDocumentRequestQuerySchema,
  SearchDocumentsRequestQuerySchema,
  GetDocumentDetailsRequestParamsSchema,
  GetDocumentDetailsRequestQuerySchema,
  SubmitCreditNoteDocumentsBodyScheme,
  SubmitCreditNoteDocumentsQueryScheme,
  SubmitDebitNoteDocumentsBodyScheme,
  SubmitDebitNoteDocumentsQueryScheme,
  SubmitRefundNoteDocumentsBodyScheme,
  SubmitRefundNoteDocumentsQueryScheme,
  SubmitSelfBilledCreditNoteDocumentsBodyScheme,
  SubmitSelfBilledCreditNoteDocumentsQueryScheme,
  SubmitSelfBilledDebitNoteDocumentsBodyScheme,
  SubmitSelfBilledDebitNoteDocumentsQueryScheme,
  SubmitSelfBilledInvoiceDocumentsBodyScheme,
  SubmitSelfBilledInvoiceDocumentsQueryScheme,
  SubmitSelfBilledRefundNoteDocumentsBodyScheme,
  SubmitSelfBilledRefundNoteDocumentsQueryScheme,
} from "src/schemes";

export const documentsController = (app: Elysia) => {
  return app.group("documents", (app) =>
    app
      .guard({
        detail: {
          tags: ["Documents"],
        },
      })
      .get(
        "/",
        ({ query }) => {
          return getRecentDocuments(query);
        },
        {
          detail: {
            summary: "Get Recent Documents",
            description: `This API allows taxpayer's systems to search the documents
            sent or received which are available on the MyInvois System using various
            filters. This API will only return documents that are issued within the
            last 31 days.`,
          },
          query: GetRecentDocumentsRequestQueryScheme,
          response: GetRecentDocumentsResponseSchema,
        }
      )

      .put(
        "/:id/cancel",
        ({ params, query }) => {
          return cancelDocument(params, query);
        },
        {
          detail: {
            summary: "Cancel Document",
            description: `This API allows issuer to cancel previously issued document,
            either self-induced cancellation or by accepting a rejection request made
            by the buyer.`,
          },
          params: CancelDocumentRequestParamsSchema,
          query: CancelDocumentRequestQuerySchema,
        }
      )
      .put(
        "/:id/reject",
        ({ params, query }) => {
          return rejectDocument(params, query);
        },
        {
          detail: {
            summary: "Reject Document",
            description: `This API allows a buyer that received an invoice to reject it
            and request the supplier to cancel it. The document ID is required as a
            path parameter, and a reason for rejection must be provided in the query.`,
          },
          params: RejectDocumentRequestParamsSchema,
          query: RejectDocumentRequestQuerySchema,
        }
      )
      .get(
        "/:id",
        async ({ params, query }) => {
          return await getDocumentDetails(params, query);
        },
        {
          detail: {
            summary: "Get Document Details",
            description: `This API allows taxpayers to retrieve a single document's full
            details. The document ID (UUID) is required as a path parameter.
            An optional taxpayerTIN can be provided in the query if the caller
            is an ERP system acting on behalf of a taxpayer.`,
          },
          params: GetDocumentDetailsRequestParamsSchema,
          query: GetDocumentDetailsRequestQuerySchema,
          // No response schema specified by user
        }
      )
      .get(
        "/:id/raw",
        async ({ params, query }) => {
          return await getDocumentRaw(params, query);
        },
        {
          detail: {
            summary: "Get Raw Document",
            description: `Retrieves the full document (including the digital signature
            block) as stored by MyInvois. The "document" field in the response is the
            signed document as a JSON string. Only available for documents that have
            been validated. The document ID (UUID) is required as a path parameter.
            An optional taxpayerTIN can be provided in the query if the caller
            is an ERP system acting on behalf of a taxpayer.`,
          },
          params: GetDocumentDetailsRequestParamsSchema,
          query: GetDocumentDetailsRequestQuerySchema,
        }
      )
      .put(
        "search",
        ({ query }) => {
          return searchDocuments(query); // Call searchDocuments service
        },
        {
          detail: {
            summary: "Search Documents",
            description: `This API allows taxpayer's systems to search the documents
            sent or received which are available on the MyInvois System using various
            filters.`,
          },
          query: SearchDocumentsRequestQuerySchema, // Added query schema
          // response: GetRecentDocumentsResponseSchema, // Response schema can be added if defined
        }
      )
      .post(
        "submit/invoice",
        ({ query, body }) => {
          return submitInvoices(query, body);
        },
        {
          detail: {
            summary: "Submit Invoices",
            description: `This API allows taxpayer to submit one or more invoices to
            MyInvois System.`,
          },
          query: SubmitInvoiceDocumentsQueryScheme,
          body: SubmitInvoiceDocumentsBodyScheme,
        }
      )
      .post(
        "submit/credit-note",
        ({ query, body }) => {
          return submitCreditNotes(query, body);
        },
        {
          detail: {
            summary: "Submit Credit Notes",
            description: `This API allows taxpayer to submit one or more Credit Note(s) to
            MyInvois System.`,
          },
          query: SubmitCreditNoteDocumentsQueryScheme,
          body: SubmitCreditNoteDocumentsBodyScheme,
        }
      )
      .post(
        "submit/debit-note",
        ({ query, body }) => {
          return submitDebitNotes(query, body);
        },
        {
          detail: {
            summary: "Submit Debit Notes",
            description: `This API allows taxpayer to submit one or more Debit Note(s) to
            MyInvois System.`,
          },
          query: SubmitDebitNoteDocumentsQueryScheme,
          body: SubmitDebitNoteDocumentsBodyScheme,
        }
      )
      .post(
        "submit/refund-note",
        ({ query, body }) => {
          return submitRefundNotes(query, body);
        },
        {
          detail: {
            summary: "Submit Refund Notes",
            description: `This API allows taxpayer to submit one or more Refund Note(s) to
            MyInvois System.`,
          },
          query: SubmitRefundNoteDocumentsQueryScheme,
          body: SubmitRefundNoteDocumentsBodyScheme,
        }
      )
      .post(
        "submit/self-billed-invoice",
        ({ query, body }) => {
          return submitSelfBilledInvoices(query, body);
        },
        {
          detail: {
            summary: "Submit Self-Billed Invoices",
            description: `This API allows taxpayer to submit one or more Self-Billed Invoice(s) to
            MyInvois System.`,
          },
          query: SubmitSelfBilledInvoiceDocumentsQueryScheme,
          body: SubmitSelfBilledInvoiceDocumentsBodyScheme,
        }
      )
      .post(
        "submit/self-billed-credit-note",
        ({ query, body }) => {
          return submitSelfBilledCreditNotes(query, body);
        },
        {
          detail: {
            summary: "Submit  Self-Billed Credit Notes",
            description: `This API allows taxpayer to submit one or more Self-Billed Credit Note(s) to
            MyInvois System.`,
          },
          query: SubmitSelfBilledCreditNoteDocumentsQueryScheme,
          body: SubmitSelfBilledCreditNoteDocumentsBodyScheme,
        }
      )
      .post(
        "submit/self-billed-debit-note",
        ({ query, body }) => {
          return submitSelfBilledDebitNotes(query, body);
        },
        {
          detail: {
            summary: "Submit  Self-Billed Debit Notes",
            description: `This API allows taxpayer to submit one or more Self-Billed Debit Note(s) to
            MyInvois System.`,
          },
          query: SubmitSelfBilledDebitNoteDocumentsQueryScheme,
          body: SubmitSelfBilledDebitNoteDocumentsBodyScheme,
        }
      )
      .post(
        "submit/self-billed-refund-note",
        ({ query, body }) => {
          return submitSelfBilledRefundNotes(query, body);
        },
        {
          detail: {
            summary: "Submit Self-Billed Refund Notes",
            description: `This API allows taxpayer to submit one or more Self-Billed Refund Note(s) to
            MyInvois System.`,
          },
          query: SubmitSelfBilledRefundNoteDocumentsQueryScheme,
          body: SubmitSelfBilledRefundNoteDocumentsBodyScheme,
        }
      )
  );
};
