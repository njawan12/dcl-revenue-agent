import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../supabase/migrations/017_data_governance.sql', import.meta.url), 'utf8');

test('governance records are workspace scoped and protected by RLS', () => {
  assert.match(migration, /workspace_id uuid not null references workspaces/);
  assert.match(migration, /alter table source_provenance enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
  assert.match(migration, /can_manage_workspace\(workspace_id\)/);
});

test('source provenance exposes licensing verification rather than claiming permission', () => {
  assert.match(migration, /license_status text not null default 'unverified'/);
  assert.match(migration, /'verified','unverified','restricted','prohibited'/);
  assert.match(migration, /terms_reference text/);
  assert.match(migration, /collection_purpose text not null/);
});

test('deletion is an auditable request workflow rather than an unguarded destructive action', () => {
  assert.match(migration, /create table data_deletion_requests/);
  assert.match(migration, /status deletion_request_status not null default 'requested'/);
  assert.match(migration, /deletion_review_admin/);
  assert.doesNotMatch(migration, /create policy .*data_deletion_requests.* for delete/i);
});

test('provenance cannot be silently rewritten by tenant users', () => {
  assert.match(migration, /source_provenance_is_append_only/);
  assert.match(migration, /source_provenance_no_update/);
  assert.doesNotMatch(migration, /provenance_.* for update/i);
});
