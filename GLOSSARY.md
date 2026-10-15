# Project-RAG

Plataforma para gerenciar organizações, agentes de IA e documentos privados associados a esses agentes.

## Plataforma e recursos

**Owner**:
Pessoa responsável pela gestão da plataforma, incluindo o envio e acompanhamento de convites para administradores.
_Avoid_: Proprietário do agente

**Administrador**:
Pessoa ativa que gerencia suas próprias organizações e os agentes nelas criados.
_Avoid_: Owner

**Organização**:
Espaço de trabalho que agrupa agentes e pertence a uma pessoa usuária da plataforma.
_Avoid_: Empresa, tenant

**Agente**:
Recurso de IA pertencente a uma organização; suas instruções são privadas e não são exibidas na página do agente.
_Avoid_: Bot, funcionário

**Documento privado**:
Arquivo PDF associado a um agente e mantido privado no contexto da organização.
_Avoid_: Documento público

**Dashboard**:
Visão inicial autenticada que resume organizações, agentes e documentos da pessoa usuária; para o owner, também apresenta convites pendentes de administradores.
_Avoid_: Dashboard de RH, painel de métricas de uso
