/* eslint-disable @typescript-eslint/await-thenable */
import { CONFIG } from "src/config";
// Assume you have a Redis client initialized and exported, e.g.:
import {
  type CreateCreditNoteDocumentParams,
  type CreateDebitNoteDocumentParams,
  type CreateInvoiceDocumentParams,
  type CreateRefundNoteDocumentParams,
  type CreateSelfBilledCreditNoteDocumentParams,
  type CreateSelfBilledDebitNoteDocumentParams,
  type CreateSelfBilledInvoiceDocumentParams,
  type CreateSelfBilledRefundNoteDocumentParams,
  type DocumentSubmissionItem,
  MyInvoisClient,
  type SignatureParams,
  createDocumentSubmissionItemFromCreditNote,
  createDocumentSubmissionItemFromDebitNote,
  createDocumentSubmissionItemFromInvoice,
  createDocumentSubmissionItemFromRefundNote,
  createDocumentSubmissionItemFromSelfBilledCreditNote,
  createDocumentSubmissionItemFromSelfBilledDebitNote,
  createDocumentSubmissionItemFromSelfBilledInvoice,
  createDocumentSubmissionItemFromSelfBilledRefundNote,
} from "myinvois-client";
import { redisInstance } from "src/redis"; // Path to your gateway's Redis client instance
import type {
  CancelDocumentRequestParams,
  CancelDocumentRequestQuery,
  GetDocumentDetailsRequestParams,
  GetDocumentDetailsRequestQuery,
  GetRecentDocumentsRequestQuery,
  RejectDocumentRequestParams,
  RejectDocumentRequestQuery,
  SearchDocumentsRequestQuery,
  SubmitCreditNoteDocumentsBody,
  SubmitCreditNoteDocumentsQuery,
  SubmitDebitNoteDocumentsBody,
  SubmitDebitNoteDocumentsQuery,
  SubmitInvoiceDocumentsBody,
  SubmitInvoiceDocumentsQuery,
  SubmitRefundNoteDocumentsBody,
  SubmitRefundNoteDocumentsQuery,
  SubmitSelfBilledCreditNoteDocumentsBody,
  SubmitSelfBilledCreditNoteDocumentsQuery,
  SubmitSelfBilledDebitNoteDocumentsBody,
  SubmitSelfBilledDebitNoteDocumentsQuery,
  SubmitSelfBilledInvoiceDocumentsBody,
  SubmitSelfBilledInvoiceDocumentsQuery,
  SubmitSelfBilledRefundNoteDocumentsBody,
  SubmitSelfBilledRefundNoteDocumentsQuery,
} from "src/schemes";
import { getSignatureParams } from "src/utils/signature";
import { MyInvoisError } from "src/utils/error-handler";

export async function getRecentDocuments(
  query: GetRecentDocumentsRequestQuery
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const { taxpayerTIN: taxpayerTIN, ...params } = query;
  try {
    const documents = await client.documents.getRecentDocuments(
      params,
      taxpayerTIN
    );
    return documents;
  } catch (error) {
    const action = taxpayerTIN
      ? `fetching documents for TIN ${taxpayerTIN}`
      : "fetching documents as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function getDocumentDetails(
  params: GetDocumentDetailsRequestParams,
  query: GetDocumentDetailsRequestQuery
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const documentId = params.id;
  const taxpayerTIN = query.taxpayerTIN;

  try {
    const documentDetails = await client.documents.getDocumentDetailsByUuid(
      documentId,
      taxpayerTIN // Pass taxpayerTIN if provided, client method should handle undefined
    );
    return documentDetails;
  } catch (error) {
    const action = taxpayerTIN
      ? `fetching document details for ID ${documentId} for TIN ${taxpayerTIN}`
      : `fetching document details for ID ${documentId} as taxpayer`;
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function searchDocuments(query: SearchDocumentsRequestQuery) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const { taxpayerTIN, ...params } = query;
  try {
    // Assuming MyInvoisClient has a method like `searchDocuments`
    // or getRecentDocuments can handle these broader search capabilities.
    // If using getRecentDocuments, ensure its parameters align or it can handle the additional fields in SearchDocumentsRequestQuery.
    const documents = await client.documents.searchDocuments(
      params,
      taxpayerTIN
    );
    return documents;
  } catch (error) {
    const action = taxpayerTIN
      ? `searching documents for TIN ${taxpayerTIN} with params ${JSON.stringify(
          params
        )}`
      : `searching documents with params ${JSON.stringify(params)} as taxpayer`;
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function rejectDocument(
  params: RejectDocumentRequestParams,
  query: RejectDocumentRequestQuery
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const { id } = params;
  const { reason, taxpayerTIN } = query;

  try {
    // Assuming MyInvoisClient has a method like `rejectDocument`
    // The actual method signature might differ, adjust as needed.
    const result = await client.documents.rejectDocument(
      id,
      reason,
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `rejecting document ${id} with reason "${reason}" for TIN ${taxpayerTIN}`
      : `rejecting document ${id} with reason "${reason}" as taxpayer`;
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function cancelDocument(
  params: CancelDocumentRequestParams,
  query: CancelDocumentRequestQuery
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const { id } = params;
  const taxpayerTIN = query.taxpayerTIN;

  try {
    const result = await client.documents.cancelDocument(
      id,
      query.reason,
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `cancelling document ${id} for TIN ${taxpayerTIN}`
      : `cancelling document ${id} as taxpayer`;
    throw new Error(
      `Failed during ${action}. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function submitInvoices(
  query: SubmitInvoiceDocumentsQuery,
  body: SubmitInvoiceDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateInvoiceDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromInvoice(
        doc as CreateInvoiceDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting invoices for TIN ${taxpayerTIN}`
      : "submitting invoices as taxpayer";

    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitCreditNotes(
  query: SubmitCreditNoteDocumentsQuery,
  body: SubmitCreditNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }
    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateCreditNoteDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromCreditNote(
        doc as CreateCreditNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting credit notes for TIN ${taxpayerTIN}`
      : "submitting credit notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitDebitNotes(
  query: SubmitDebitNoteDocumentsQuery,
  body: SubmitDebitNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateDebitNoteDocumentParams).signature = signature;
      }

      let _doc = await createDocumentSubmissionItemFromDebitNote(
        doc as CreateDebitNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting debit notes for TIN ${taxpayerTIN}`
      : "submitting debit notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitRefundNotes(
  query: SubmitRefundNoteDocumentsQuery,
  body: SubmitRefundNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateRefundNoteDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromRefundNote(
        doc as CreateRefundNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting refund notes for TIN ${taxpayerTIN}`
      : "submitting refund notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitSelfBilledInvoices(
  query: SubmitSelfBilledInvoiceDocumentsQuery,
  body: SubmitSelfBilledInvoiceDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateSelfBilledInvoiceDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromSelfBilledInvoice(
        doc as CreateSelfBilledInvoiceDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting self-billed invoices for TIN ${taxpayerTIN}`
      : "submitting self-billed invoices as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitSelfBilledCreditNotes(
  query: SubmitSelfBilledCreditNoteDocumentsQuery,
  body: SubmitSelfBilledCreditNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateSelfBilledCreditNoteDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromSelfBilledCreditNote(
        doc as CreateSelfBilledCreditNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting self-billed credit notes for TIN ${taxpayerTIN}`
      : "submitting self-billed credit notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitSelfBilledDebitNotes(
  query: SubmitSelfBilledDebitNoteDocumentsQuery,
  body: SubmitSelfBilledDebitNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateSelfBilledDebitNoteDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromSelfBilledDebitNote(
        doc as CreateSelfBilledDebitNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting self-billed debit notes for TIN ${taxpayerTIN}`
      : "submitting self-billed debit notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}

export async function submitSelfBilledRefundNotes(
  query: SubmitSelfBilledRefundNoteDocumentsQuery,
  body: SubmitSelfBilledRefundNoteDocumentsBody
) {
  const client = new MyInvoisClient(
    CONFIG.clientId,
    CONFIG.clientSecret,
    CONFIG.env,
    redisInstance
  );

  const taxpayerTIN = query.taxpayerTIN;
  const _documents = body.documents;
  try {
    let signature: SignatureParams | undefined;
    if (query.sign) {
      signature = await getSignatureParams();
    }

    let documents: DocumentSubmissionItem[] = [];

    for await (const doc of _documents) {
      if (signature) {
        (doc as CreateSelfBilledRefundNoteDocumentParams).signature = signature;
      }
      let _doc = await createDocumentSubmissionItemFromSelfBilledRefundNote(
        doc as CreateSelfBilledRefundNoteDocumentParams,
        signature ? "1.1" : "1.0"
      );
      documents.push(_doc);
    }

    if (query.dryRun) return documents;
    const result = await client.documents.submitDocuments(
      { documents: documents },
      taxpayerTIN
    );
    return result;
  } catch (error) {
    const action = taxpayerTIN
      ? `submitting self-billed refund notes for TIN ${taxpayerTIN}`
      : "submitting self-billed refund notes as taxpayer";
    throw new MyInvoisError(`Failed during ${action}`, error);
  }
}
