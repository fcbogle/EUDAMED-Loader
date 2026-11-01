export type ImportMetadata = {
    creator: {
        name: string;
        email: string;
        team_role: string;
    };
    description: string;
    source_date: string | null;
    export_date: string | null;
};
export type ImportSources = {
    templates: File[];
    basic: File[];
    xml: File[];
};
export type ImportFlowContext = {
    batchId: string;
    status: string;
};
export type ImportChoice = {
    id: string;
    description: string;
    status: string;
};
export type ImportSession = {
    id: string;
    revision: string | null;
    batch_id: string | null;
    stage: "review" | "workbook" | "import" | "complete";
    metadata: ImportMetadata;
    files: {
        path: string;
        role: string;
        original_name?: string;
        size_bytes: number; excluded?: boolean;
    }[];
    review: {
        message: string;
        can_create: boolean;
        groups: {
            code: string;
            source: string;
            title: string;
            severity: "block" | "warn";
            action: string;
            count: number;
            truncated?: boolean;
            records: {
                file?: string;
                sheet?: string;
                row?: number;
                identifier?: string;
                udi_di?: string;
                detail?: string;
                locations?: {file?: string; sheet?: string; row?: number; identifier: string}[];
                fields?: {
                    field: string;
                    before: unknown;
                    after: unknown;
                }[];
            }[];
        }[];
    } | null;
    workbook: {
        artifact_id: string;
        workbook_name: string;
    } | null;
    summary: {
        new_count: number;
        existing_retained_count: number;
        omitted_retained_count: number;
    } | null;
    result: {
        created_count: number;
        confirmed_at: string;
        confirmed_by: string;
        backup: {
            path: string;
        };
    } | null;
};
