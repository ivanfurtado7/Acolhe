import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users, Shield, UserPlus, CheckCircle, XCircle, Plus, Edit3, Trash2, CheckSquare, Clock, Lock } from 'lucide-react'

type RolePermissions = { [module: string]: { [action: string]: boolean } }

const defaultPermissions: RolePermissions = {
  mural: { view: false, create: false, manage_status: false, delete: false },
  acolhimento: { view: false, manage_funnel: false, assign_leader: false, add_notes: false, delete: false },
  grupos: { view: false, create: false, edit: false, delete: false },
  escalas: { view: false, manage_sectors: false, assign: false, remove: false, respond: false },
  qrcode: { view: false },
  admin: { manage_requests: false, manage_members: false, manage_roles: false }
}

const PERMISSIONS_SCHEMA = [
  { module: 'mural', label: 'Mural & Agenda', actions: [{ key: 'view', label: 'Visualizar Mural e Eventos' }, { key: 'create', label: 'Criar Avisos e Eventos' }, { key: 'manage_status', label: 'Alterar Status de Eventos' }, { key: 'delete', label: 'Excluir Publicações' }] },
  { module: 'acolhimento', label: 'Acolhimento de Visitantes', actions: [{ key: 'view', label: 'Ver Fichas de Visitantes' }, { key: 'manage_funnel', label: 'Alterar Fase do Funil' }, { key: 'assign_leader', label: 'Atribuir Líder/Acolhedor' }, { key: 'add_notes', label: 'Adicionar Anotações' }, { key: 'delete', label: 'Excluir Fichas' }] },
  { module: 'grupos', label: 'Grupos de Cuidado', actions: [{ key: 'view', label: 'Ver Grupos (Células)' }, { key: 'create', label: 'Criar Novos Grupos' }, { key: 'edit', label: 'Editar Dados e Líderes' }, { key: 'delete', label: 'Excluir Grupos' }] },
  { module: 'escalas', label: 'Escalas e Voluntariado', actions: [{ key: 'view', label: 'Ver Escalas e Equipes' }, { key: 'manage_sectors', label: 'Gerenciar Setores' }, { key: 'assign', label: 'Escalar Voluntários' }, { key: 'remove', label: 'Remover da Escala' }, { key: 'respond', label: 'Confirmar/Recusar Própria Escala' }] },
  { module: 'qrcode', label: 'QR Code Ficha', actions: [{ key: 'view', label: 'Acessar Link e QR Code' }] },
  { module: 'admin', label: 'Administração Geral', actions: [{ key: 'manage_requests', label: 'Aprovar/Recusar Cadastros' }, { key: 'manage_members', label: 'Gerenciar Membros' }, { key: 'manage_roles', label: 'Configurar Matriz de Acesso' }] }
];

export function SettingsManagement({ churchId, currentUserRole, currentPerms }: { churchId: string, currentUserRole: string, currentPerms: any }) {
  const hasRequestsAccess = currentPerms?.admin?.manage_requests || currentPerms?.admin_requests?.view || currentUserRole === 'admin';
  const hasMembersAccess = currentPerms?.admin?.manage_members || currentPerms?.admin_members?.view || currentUserRole === 'admin';
  const hasRolesAccess = currentPerms?.admin?.manage_roles || currentPerms?.admin_roles?.view || currentUserRole === 'admin';

  const initialTab = hasRequestsAccess ? 'requests' : hasMembersAccess ? 'members' : hasRolesAccess ? 'roles' : 'requests';
  const [activeTab, setActiveTab] = useState<'requests' | 'members' | 'roles'>(initialTab)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [memberPermissions, setMemberPermissions] = useState<RolePermissions>(defaultPermissions)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null) 
  const [roleName, setRoleName] = useState('')
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions)

  useEffect(() => { if (!hasRequestsAccess && activeTab === 'requests') setActiveTab(hasMembersAccess ? 'members' : 'roles'); }, [hasRequestsAccess, hasMembersAccess, hasRolesAccess, activeTab])
  useEffect(() => { if (churchId) fetchData() }, [churchId, activeTab])

  async function fetchData() {
    setLoading(true)
    setSelectedRequests([])

    if (activeTab === 'requests') {
      const { data: reqData } = await supabase.from('join_requests').select('*').eq('church_id', churchId).order('created_at', { ascending: false })
      if (reqData && reqData.length > 0) {
        const userIds = [...new Set([...reqData.map(r => r.user_id), ...reqData.map(r => r.resolved_by).filter(Boolean)])]
        const { data: profData } = await supabase.from('user_profiles').select('id, full_name, whatsapp').in('id', userIds)
        const combinedData = reqData.map(req => ({ ...req, user: profData?.find(p => p.id === req.user_id), resolver: profData?.find(p => p.id === req.resolved_by) }))
        setPendingRequests(combinedData.filter(r => r.status === 'pending'))
        setResolvedRequests(combinedData.filter(r => r.status !== 'pending'))
      } else { setPendingRequests([]); setResolvedRequests([]) }
    } else if (activeTab === 'members') {
      const { data } = await supabase.from('user_profiles').select('*, custom_role:custom_roles(name)').eq('church_id', churchId).order('full_name')
      if (data) setMembers(data)
    } else if (activeTab === 'roles') {
      const { data: rolesData } = await supabase.from('custom_roles').select('*').eq('church_id', churchId).order('name')
      if (rolesData) setRoles(rolesData)
      const { data: churchData } = await supabase.from('churches').select('member_permissions').eq('id', churchId).single()
      if (churchData && churchData.member_permissions) setMemberPermissions({ ...defaultPermissions, ...churchData.member_permissions as any })
    }
    setLoading(false)
  }

  const handleSelectAll = () => selectedRequests.length === pendingRequests.length ? setSelectedRequests([]) : setSelectedRequests(pendingRequests.map(r => r.id))
  const toggleSelectOne = (id: string) => selectedRequests.includes(id) ? setSelectedRequests(prev => prev.filter(reqId => reqId !== id)) : setSelectedRequests(prev => [...prev, id])

  const handleApproveRequest = async (requestId: string, userId: string) => {
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('user_profiles').update({ church_id: churchId, role: 'membro' }).eq('id', userId)
    await supabase.from('join_requests').update({ status: 'approved', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).eq('id', requestId)
    await fetchData(); setActionLoading(false)
  }

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('join_requests').update({ status: 'rejected', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).eq('id', requestId)
    await fetchData(); setActionLoading(false)
  }

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0 || !confirm(`Tem certeza que deseja aprovar ${selectedRequests.length} solicitações?`)) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const userIdsToApprove = pendingRequests.filter(r => selectedRequests.includes(r.id)).map(r => r.user_id)
    await supabase.from('user_profiles').update({ church_id: churchId, role: 'membro' }).in('id', userIdsToApprove)
    await supabase.from('join_requests').update({ status: 'approved', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).in('id', selectedRequests)
    await fetchData(); setActionLoading(false)
  }

  const handleBulkReject = async () => {
    if (selectedRequests.length === 0 || !confirm(`Tem certeza que deseja recusar ${selectedRequests.length} solicitações?`)) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('join_requests').update({ status: 'rejected', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).in('id', selectedRequests)
    await fetchData(); setActionLoading(false)
  }

  const handleChangeMemberRole = async (userId: string, newBaseRole: string, newCustomRoleId: string | null) => {
    const memberToChange = members.find(m => m.id === userId)
    if (memberToChange?.role === 'admin' && newBaseRole !== 'admin' && members.filter(m => m.role === 'admin').length <= 1) {
      alert("Ação negada! A comunidade deve ter no mínimo um Administrador Master ativo."); return;
    }
    await supabase.from('user_profiles').update({ role: newBaseRole, custom_role_id: newCustomRoleId }).eq('id', userId)
    fetchData()
  }

  const handleOpenRoleForm = (role?: any, isNativeMember: boolean = false) => {
    if (isNativeMember) { setEditingRoleId('native_membro'); setRoleName('Membro'); setPermissions(memberPermissions); }
    else if (role) { setEditingRoleId(role.id); setRoleName(role.name); setPermissions({ ...defaultPermissions, ...(role.permissions || {}) }); }
    else { setEditingRoleId(null); setRoleName(''); setPermissions(defaultPermissions); }
    setShowRoleForm(true)
  }

  const handlePermissionChange = (module: string, action: string) => {
    setPermissions(prev => ({ ...prev, [module]: { ...(prev[module] || {}), [action]: !prev[module]?.[action] } }))
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRoleId === 'native_membro') await supabase.from('churches').update({ member_permissions: permissions }).eq('id', churchId)
    else {
      const payload = { church_id: churchId, name: roleName, permissions }
      if (editingRoleId) await supabase.from('custom_roles').update(payload).eq('id', editingRoleId)
      else await supabase.from('custom_roles').insert([payload])
    }
    setShowRoleForm(false); fetchData()
  }

  const handleDeleteRole = async (id: string) => {
    if (confirm('Deseja excluir este cargo? Membros voltarão a ser Base.')) { await supabase.from('custom_roles').delete().eq('id', id); fetchData(); }
  }

  const renderPermissionBadges = (perms: RolePermissions) => {
    if (!perms) return <span className="text-[10px] text-stone-400 font-medium bg-stone-50 px-2.5 py-1 rounded-md">Sem acessos</span>
    const badges = []
    if (perms.mural?.view) badges.push(<span key="mu" className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-amber-100">Mural</span>)
    if (perms.acolhimento?.view) badges.push(<span key="ac" className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-blue-100">Acolhimento</span>)
    if (perms.grupos?.view) badges.push(<span key="gr" className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-emerald-100">Grupos</span>)
    if (perms.escalas?.view) badges.push(<span key="es" className="bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-orange-100">Escalas</span>)
    if (perms.admin?.manage_requests || perms.admin?.manage_members || perms.admin?.manage_roles) badges.push(<span key="ad" className="bg-purple-50 text-purple-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-purple-100">Admin</span>)
    if (badges.length === 0) return <span className="text-[10px] text-stone-400 font-medium bg-stone-50 px-2.5 py-1 rounded-md">Restrito</span>
    return badges
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      <div className="bg-white border border-stone-200 rounded-3xl p-5 md:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-black mb-1 tracking-tight text-stone-800">Administração Geral</h2>
          <p className="text-stone-500 text-sm md:text-base">Gerencie o acesso e equipes da comunidade.</p>
        </div>

        <div className="flex gap-2 bg-stone-100 p-1.5 md:p-2 rounded-2xl overflow-x-auto scrollbar-hide">
          {hasRequestsAccess && (
            <button onClick={() => setActiveTab('requests')} className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'requests' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>
              <UserPlus size={18} /> <span className="hidden sm:inline">Solicitações</span> {pendingRequests.length > 0 && <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
            </button>
          )}
          {hasMembersAccess && (
            <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'members' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>
              <Users size={18} /> <span className="hidden sm:inline">Membros</span>
            </button>
          )}
          {hasRolesAccess && (
            <button onClick={() => setActiveTab('roles')} className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === 'roles' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>
              <Shield size={18} /> <span className="hidden sm:inline">Cargos e Permissões</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-stone-400 font-bold animate-pulse text-sm">Carregando...</div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-3xl p-5 md:p-8 shadow-sm">
          
          {/* ABA SOLICITAÇÕES */}
          {activeTab === 'requests' && hasRequestsAccess && (
            <div className="space-y-8">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-stone-100 pb-4">
                  <h3 className="font-bold text-lg md:text-xl text-stone-800">Aguardando Aprovação</h3>
                  {pendingRequests.length > 0 && currentPerms?.admin?.manage_requests && (
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-stone-50 p-2 md:p-1.5 rounded-2xl border border-stone-200 w-full sm:w-auto">
                      <label className="flex items-center justify-center gap-2 px-3 py-2 cursor-pointer w-full sm:w-auto">
                        <input type="checkbox" checked={selectedRequests.length === pendingRequests.length && pendingRequests.length > 0} onChange={handleSelectAll} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Selecionar Todos</span>
                      </label>
                      {selectedRequests.length > 0 && (
                        <div className="flex gap-2 w-full sm:w-auto sm:border-l sm:border-stone-200 sm:pl-3">
                          <button disabled={actionLoading} onClick={handleBulkReject} className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl disabled:opacity-50">Recusar</button>
                          <button disabled={actionLoading} onClick={handleBulkApprove} className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl shadow-sm disabled:opacity-50 flex justify-center items-center gap-1"><CheckSquare size={16} /> Aprovar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 border-2 border-dashed border-stone-100 rounded-3xl bg-stone-50/50 text-sm">Nenhuma solicitação pendente.</div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map(req => (
                      <label key={req.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 md:p-5 border rounded-2xl gap-4 transition-all ${currentPerms?.admin?.manage_requests ? 'cursor-pointer' : ''} ${selectedRequests.includes(req.id) ? 'bg-amber-50 border-amber-300' : 'bg-white border-stone-200 shadow-sm'}`}>
                        <div className="flex items-center gap-4">
                          {currentPerms?.admin?.manage_requests && <input type="checkbox" checked={selectedRequests.includes(req.id)} onChange={() => toggleSelectOne(req.id)} className="w-6 h-6 accent-amber-600 rounded cursor-pointer shrink-0" />}
                          <div>
                            <p className="font-bold text-stone-800 text-base md:text-lg">{req.user?.full_name}</p>
                            <p className="text-xs md:text-sm text-stone-500 font-medium">{req.user?.whatsapp} • {new Date(req.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        {selectedRequests.length === 0 && currentPerms?.admin?.manage_requests && (
                          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <button disabled={actionLoading} onClick={(e) => { e.preventDefault(); handleRejectRequest(req.id); }} className="flex-1 sm:flex-none px-5 py-3 bg-red-50 text-red-600 font-bold text-sm rounded-xl flex items-center justify-center gap-2"><XCircle size={18} /> Recusar</button>
                            <button disabled={actionLoading} onClick={(e) => { e.preventDefault(); handleApproveRequest(req.id, req.user_id); }} className="flex-1 sm:flex-none px-5 py-3 bg-amber-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"><CheckCircle size={18} /> Aprovar</button>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA MEMBROS */}
          {activeTab === 'members' && hasMembersAccess && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg md:text-xl text-stone-800 mb-4">Comunidade</h3>
              {/* Em mobile, tabelas são ruins. Mudamos para um layout de cards ou lista compacta */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(member => (
                  <div key={member.id} className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex flex-col gap-3">
                    <div>
                      <p className="font-bold text-stone-800 text-base md:text-lg">{member.full_name}</p>
                      <p className="text-sm text-stone-500">{member.whatsapp}</p>
                    </div>
                    {currentPerms?.admin?.manage_members ? (
                      <select value={`${member.role}|${member.custom_role_id || ''}`} onChange={(e) => { const [baseRole, customId] = e.target.value.split('|'); handleChangeMemberRole(member.id, baseRole, customId || null); }} className="w-full bg-white border border-stone-200 text-sm font-bold text-stone-700 rounded-xl px-4 py-3 outline-none focus:border-amber-500 shadow-sm mt-auto">
                        <optgroup label="Acessos Base">
                          <option value="membro|">Membro</option>
                          <option value="admin|">Admin Master</option>
                        </optgroup>
                        {roles.length > 0 && (
                          <optgroup label="Cargos Personalizados">
                            {roles.map(r => <option key={r.id} value={`lider|${r.id}`}>{r.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    ) : (
                      <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 mt-auto">
                        <span className="text-sm font-bold text-stone-600">{member.role === 'admin' ? 'Admin Master' : member.role === 'lider' ? member.custom_role?.name : 'Membro'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA CARGOS */}
          {activeTab === 'roles' && hasRolesAccess && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="font-bold text-lg md:text-xl text-stone-800">Gerenciar Perfis</h3>
                {!showRoleForm && currentPerms?.admin?.manage_roles && (
                  <button onClick={() => handleOpenRoleForm()} className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-stone-900 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer">
                    <Plus size={18} /> Novo Cargo
                  </button>
                )}
              </div>

              {showRoleForm ? (
                <form onSubmit={handleSaveRole} className="bg-stone-50 p-5 md:p-8 rounded-[2rem] border border-stone-200 shadow-inner">
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nome do Cargo</label>
                    <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} disabled={editingRoleId === 'native_membro'} required className="w-full px-4 py-3.5 md:py-3 bg-white border border-stone-200 rounded-xl text-base font-medium shadow-sm outline-none focus:border-amber-500 disabled:bg-stone-100 disabled:text-stone-400" />
                  </div>
                  
                  <div className="mb-8">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">Matriz de Acesso</label>
                    <div className="space-y-4">
                      {PERMISSIONS_SCHEMA.map(mod => (
                        <div key={mod.module} className="border border-stone-200 rounded-2xl p-5 bg-white shadow-sm">
                          <h4 className="font-bold text-stone-800 mb-4 text-sm md:text-base border-b border-stone-100 pb-3">{mod.label}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {mod.actions.map(act => (
                              <label key={act.key} className="flex items-center gap-3 p-2 bg-stone-50 hover:bg-amber-50 rounded-xl cursor-pointer group transition-colors">
                                <input type="checkbox" checked={permissions[mod.module]?.[act.key] || false} onChange={() => handlePermissionChange(mod.module, act.key)} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
                                <span className="text-sm font-semibold text-stone-700">{act.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-200">
                    <button type="button" onClick={() => setShowRoleForm(false)} className="w-full sm:w-auto px-6 py-4 md:py-3 bg-white border border-stone-200 text-stone-600 font-bold rounded-xl cursor-pointer text-sm">Cancelar</button>
                    <button type="submit" className="w-full sm:w-auto px-6 py-4 md:py-3 bg-amber-600 text-white font-bold rounded-xl shadow-md cursor-pointer text-sm">Salvar Alterações</button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-stone-900 p-6 md:p-8 rounded-3xl flex justify-between items-start relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4"><Lock size={120} /></div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-white text-lg md:text-xl mb-1">Admin Master</h4>
                      <p className="text-xs md:text-sm text-stone-400 mb-4">Perfil inalterável</p>
                      <span className="bg-stone-800 text-stone-300 text-[10px] md:text-xs px-3 py-1.5 rounded-lg uppercase font-bold">Acesso Total</span>
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 p-6 md:p-8 rounded-3xl flex justify-between items-start shadow-sm">
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg md:text-xl mb-1">Membro</h4>
                      <p className="text-xs md:text-sm text-stone-400 mb-4">Perfil base</p>
                      <div className="flex flex-wrap gap-2">{renderPermissionBadges(memberPermissions)}</div>
                    </div>
                    {currentPerms?.admin?.manage_roles && <button onClick={() => handleOpenRoleForm(null, true)} className="p-3 bg-stone-50 hover:bg-amber-50 text-stone-400 hover:text-amber-600 rounded-xl cursor-pointer"><Edit3 size={20} /></button>}
                  </div>

                  {roles.map(role => (
                    <div key={role.id} className="bg-white border border-stone-200 p-6 md:p-8 rounded-3xl flex justify-between items-start shadow-sm">
                      <div>
                        <h4 className="font-bold text-stone-800 text-lg md:text-xl mb-1">{role.name}</h4>
                        <p className="text-xs md:text-sm text-stone-400 mb-4">Personalizado</p>
                        <div className="flex flex-wrap gap-2">{renderPermissionBadges(role.permissions as RolePermissions)}</div>
                      </div>
                      <div className="flex gap-2">
                        {currentPerms?.admin?.manage_roles && <button onClick={() => handleOpenRoleForm(role)} className="p-2 md:p-3 bg-stone-50 hover:bg-amber-50 text-stone-400 hover:text-amber-600 rounded-xl cursor-pointer"><Edit3 size={20} /></button>}
                        {currentPerms?.admin?.manage_roles && <button onClick={() => handleDeleteRole(role.id)} className="p-2 md:p-3 bg-stone-50 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-xl cursor-pointer"><Trash2 size={20} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}