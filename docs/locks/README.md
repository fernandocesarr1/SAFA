# Lock de escrita no banco

A ausência de `database-writer.json` significa que não há lock de escrita no
banco. Sua presença significa que o banco está reservado para a única migration
identificada no arquivo.

O mecanismo padrão do SAFA é o arquivo versionado definido em `AGENTS.md` §4. A
alternativa por issue no GitHub só deve ser usada quando Fernando a determinar
expressamente para aquela operação.

Formato:

```json
{
  "agent": "codex",
  "migration": "nome_em_snake_case",
  "authorized_by": "Fernando",
  "authorization_reference": "conversa, issue ou PR",
  "started_at": "2026-09-02T23:45:58Z",
  "expires_at": "2026-09-03T00:45:58Z"
}
```

Para o lock ser global, sua aquisição precisa chegar à `main` antes de qualquer
escrita no Supabase. O agente então parte dessa `main`, aplica somente a migration
autorizada, versiona o SQL e remove o lock no commit final da migration. Lock
vencido continua bloqueando; somente Fernando pode autorizar sua remoção.
