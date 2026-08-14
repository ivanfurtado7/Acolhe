import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users, Shield, UserPlus, CheckCircle, XCircle, Plus, Edit3, Trash2, CheckSquare, Clock, Lock } from 'lucide-react'

// Nova Tipagem Flexível para as Permissões Granulares
type RolePermissions = {
  [module: string]: {
    [action: string]: boolean
  }
}

const defaultPermissions: RolePermissions = {
  mural: { view: false, create: false, manage_status: false, delete: false },
  acolhimento: { view: false, manage_funnel: false, assign_leader: false, add_notes: false, delete: false },
  grupos: { view: false, create: false, edit: false, delete: false },
  escalas: { view: false, manage_sectors: false, assign: false, remove: false, respond: false },
  qrcode: { view: false },
  admin: { manage_requests: false, manage_members: false, manage_roles: false }
}

const PERMISSIONS_SCHEMA = [
  {
    module: 'mural',
    label: 'Mural & Agenda',
    actions: [
      { key: 'view', label: 'Visualizar Mural e Eventos' },
      { key: 'create', label: 'Criar Avisos e Eventos' },
      { key: 'manage_status', label: 'Alterar Status de Eventos' },
      { key: 'delete', label: 'Excluir Publicações' }
    ]
  },
  {
    module: 'acolhimento',
    label: 'Acolhimento de Visitantes',
    actions: [
      { key: 'view', label: 'Ver Fichas de Visitantes' },
      { key: 'manage_funnel', label: 'Alterar Fase do Funil' },
      { key: 'assign_leader', label: 'Atribuir Líder/Acolhedor' },
      { key: 'add_notes', label: 'Adicionar Anotações' },
      { key: 'delete', label: 'Excluir Fichas' }
    ]
  },
  {
    module: 'grupos',
    label: 'Grupos de Cuidado',
    actions: [
      { key: 'view', label: 'Ver Grupos (Células)' },
      { key: 'create', label: 'Criar Novos Grupos' },
      { key: 'edit', label: 'Editar Dados e Líderes' },
      { key: 'delete', label: 'Excluir Grupos' }
    ]
  },
  {
    module: 'escalas',
    label: 'Escalas e Voluntariado',
    actions: [
      { key: 'view', label: 'Ver Escalas e Equipes' },
      { key: 'manage_sectors', label: 'Gerenciar Setores' },
      { key: 'assign', label: 'Escalar Voluntários' },
      { key: 'remove', label: 'Remover da Escala' },
      { key: 'respond', label: 'Confirmar/Recusar Própria Escala' }
    ]
  },
  {
    module: 'qrcode',
    label: 'QR Code Ficha',
    actions: [
      { key: 'view', label: 'Acessar Link e QR Code' }
    ]
  },
  {
    module: 'admin',
    label: 'Administração Geral',
    actions: [
      { key: 'manage_requests', label: 'Aprovar/Recusar Cadastros' },
      { key: 'manage_members', label: 'Gerenciar Membros' },
      { key: 'manage_roles', label: 'Configurar Matriz de Acesso' }
    ]
  }
];

export function SettingsManagement({ churchId, currentUserRole, currentPerms }: { churchId: string, currentUserRole: string, currentPerms: any }) {
  
  // Segurança: Só exibe as abas permitidas pelas novas permissões granulares
  const hasRequestsAccess = currentPerms?.admin?.manage_requests || currentPerms?.admin_requests?.view || currentUserRole === 'admin';
  const hasMembersAccess = currentPerms?.admin?.manage_members || currentPerms?.admin_members?.view || currentUserRole === 'admin';
  const hasRolesAccess = currentPerms?.admin?.manage_roles || currentPerms?.admin_roles?.view || currentUserRole === 'admin';

  const initialTab = hasRequestsAccess ? 'requests' : hasMembersAccess ? 'members' : hasRolesAccess ? 'roles' : 'requests';
  const [activeTab, setActiveTab] = useState<'requests' | 'members' | 'roles'>(initialTab)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Dados Divididos
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [memberPermissions, setMemberPermissions] = useState<RolePermissions>(defaultPermissions)

  // Controle de Seleção em Massa
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])

  // Formulário de Cargos e Permissões
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null) 
  const [roleName, setRoleName] = useState('')
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions)

  useEffect(() => {
    if (!hasRequestsAccess && activeTab === 'requests') setActiveTab(hasMembersAccess ? 'members' : 'roles');
  }, [hasRequestsAccess, hasMembersAccess, hasRolesAccess, activeTab])

  useEffect(() => {
    if (churchId) fetchData()
  }, [churchId, activeTab])

  async function fetchData() {
    setLoading(true)
    setSelectedRequests([])

    if (activeTab === 'requests') {
      const { data: reqData } = await supabase.from('join_requests').select('*').eq('church_id', churchId).order('created_at', { ascending: false })

      if (reqData && reqData.length > 0) {
        const userIds = [...new Set([...reqData.map(r => r.user_id), ...reqData.map(r => r.resolved_by).filter(Boolean)])]
        const { data: profData } = await supabase.from('user_profiles').select('id, full_name, whatsapp').in('id', userIds)

        const combinedData = reqData.map(req => ({
          ...req,
          user: profData?.find(p => p.id === req.user_id),
          resolver: profData?.find(p => p.id === req.resolved_by)
        }))

        setPendingRequests(combinedData.filter(r => r.status === 'pending'))
        setResolvedRequests(combinedData.filter(r => r.status !== 'pending'))
      } else {
        setPendingRequests([])
        setResolvedRequests([])
      }
    } else if (activeTab === 'members') {
      const { data } = await supabase.from('user_profiles').select('*, custom_role:custom_roles(name)').eq('church_id', churchId).order('full_name')
      if (data) setMembers(data)
    } else if (activeTab === 'roles') {
      const { data: rolesData } = await supabase.from('custom_roles').select('*').eq('church_id', churchId).order('name')
      if (rolesData) setRoles(rolesData)
      
      const { data: churchData } = await supabase.from('churches').select('member_permissions').eq('id', churchId).single()
      if (churchData && churchData.member_permissions) {
        setMemberPermissions({ ...defaultPermissions, ...churchData.member_permissions as any })
      }
    }
    setLoading(false)
  }

  // --- LÓGICA DE SOLICITAÇÕES ---
  const handleSelectAll = () => {
    if (selectedRequests.length === pendingRequests.length) setSelectedRequests([])
    else setSelectedRequests(pendingRequests.map(r => r.id))
  }

  const toggleSelectOne = (id: string) => {
    if (selectedRequests.includes(id)) setSelectedRequests(prev => prev.filter(reqId => reqId !== id))
    else setSelectedRequests(prev => [...prev, id])
  }

  const handleApproveRequest = async (requestId: string, userId: string) => {
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('user_profiles').update({ church_id: churchId, role: 'membro' }).eq('id', userId)
    await supabase.from('join_requests').update({ status: 'approved', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).eq('id', requestId)
    await fetchData()
    setActionLoading(false)
  }

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('join_requests').update({ status: 'rejected', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).eq('id', requestId)
    await fetchData()
    setActionLoading(false)
  }

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) return
    if (!confirm(`Tem certeza que deseja aprovar ${selectedRequests.length} solicitações?`)) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const userIdsToApprove = pendingRequests.filter(r => selectedRequests.includes(r.id)).map(r => r.user_id)
    await supabase.from('user_profiles').update({ church_id: churchId, role: 'membro' }).in('id', userIdsToApprove)
    await supabase.from('join_requests').update({ status: 'approved', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).in('id', selectedRequests)
    await fetchData()
    setActionLoading(false)
  }

  const handleBulkReject = async () => {
    if (selectedRequests.length === 0) return
    if (!confirm(`Tem certeza que deseja recusar ${selectedRequests.length} solicitações?`)) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('join_requests').update({ status: 'rejected', resolved_by: session?.user?.id, resolved_at: new Date().toISOString() }).in('id', selectedRequests)
    await fetchData()
    setActionLoading(false)
  }

  // --- LÓGICA DE MEMBROS ---
  const handleChangeMemberRole = async (userId: string, newBaseRole: string, newCustomRoleId: string | null) => {
    const memberToChange = members.find(m => m.id === userId)
    if (memberToChange?.role === 'admin' && newBaseRole !== 'admin') {
      const adminCount = members.filter(m => m.role === 'admin').length
      if (adminCount <= 1) {
        alert("Ação negada! A comunidade deve ter no mínimo um Administrador Master ativo.")
        return
      }
    }
    await supabase.from('user_profiles').update({ role: newBaseRole, custom_role_id: newCustomRoleId }).eq('id', userId)
    fetchData()
  }

  // --- LÓGICA DE CARGOS E PERMISSÕES (NOVO MODELO GRANULAR) ---
  const handleOpenRoleForm = (role?: any, isNativeMember: boolean = false) => {
    if (isNativeMember) {
      setEditingRoleId('native_membro')
      setRoleName('Membro')
      setPermissions(memberPermissions)
    } else if (role) {
      setEditingRoleId(role.id)
      setRoleName(role.name)
      setPermissions({ ...defaultPermissions, ...(role.permissions || {}) })
    } else {
      setEditingRoleId(null)
      setRoleName('')
      setPermissions(defaultPermissions)
    }
    setShowRoleForm(true)
  }

  const handlePermissionChange = (module: string, action: string) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [action]: !prev[module]?.[action]
      }
    }))
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingRoleId === 'native_membro') {
      await supabase.from('churches').update({ member_permissions: permissions }).eq('id', churchId)
    } else {
      const payload = { church_id: churchId, name: roleName, permissions }
      if (editingRoleId) await supabase.from('custom_roles').update(payload).eq('id', editingRoleId)
      else await supabase.from('custom_roles').insert([payload])
    }
    
    setShowRoleForm(false)
    fetchData()
  }

  const handleDeleteRole = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cargo? Os membros que o possuem voltarão a ser Membros Base.')) {
      await supabase.from('custom_roles').delete().eq('id', id)
      fetchData()
    }
  }

  const renderPermissionBadges = (perms: RolePermissions) => {
    if (!perms) return <span className="text-xs text-stone-400 font-medium bg-stone-50 px-2 py-1 rounded-md">Sem acessos</span>
    const badges = []
    
    if (perms.mural?.view) badges.push(<span key="mural" className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Mural</span>)
    if (perms.acolhimento?.view) badges.push(<span key="acolhimento" className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Acolhimento</span>)
    if (perms.grupos?.view) badges.push(<span key="grupos" className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Grupos</span>)
    if (perms.escalas?.view) badges.push(<span key="escalas" className="bg-orange-50 border border-orange-100 text-orange-700 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Escalas</span>)
    
    const hasAdmin = perms.admin?.manage_requests || perms.admin?.manage_members || perms.admin?.manage_roles;
    if (hasAdmin) badges.push(<span key="admin" className="bg-purple-50 border border-purple-100 text-purple-700 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Admin</span>)
    
    if (badges.length === 0) return <span className="text-xs text-stone-400 font-medium bg-stone-50 px-2 py-1 rounded-md">Restrito</span>
    return badges
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* HEADER E ABAS DINÂMICAS */}
      <div className="bg-white border border-stone-200 rounded-[2rem] p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-black mb-1 tracking-tight text-stone-800">Administração Geral</h2>
          <p className="text-stone-500 text-sm">Gerencie o acesso, perfis e as equipes da sua comunidade.</p>
        </div>

        <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 overflow-x-auto scrollbar-hide">
          {hasRequestsAccess && (
            <button onClick={() => setActiveTab('requests')} className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'requests' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <UserPlus size={18} /> Solicitações {pendingRequests.length > 0 && <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
            </button>
          )}
          {hasMembersAccess && (
            <button onClick={() => setActiveTab('members')} className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'members' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <Users size={18} /> Gestão de Membros
            </button>
          )}
          {hasRolesAccess && (
            <button onClick={() => setActiveTab('roles')} className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'roles' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <Shield size={18} /> Cargos e Permissões
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-stone-400 font-bold animate-pulse">Carregando dados...</div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-[2rem] p-6 sm:p-8 shadow-sm">
          
          {/* ABA 1: SOLICITAÇÕES */}
          {activeTab === 'requests' && hasRequestsAccess && (
            <div className="space-y-10 animate-in fade-in">
              
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-stone-100 pb-4">
                  <h3 className="font-bold text-lg text-stone-800">Aguardando Aprovação</h3>
                  
                  {/* Se tem permissão de gerenciar, mostra ações em massa */}
                  {pendingRequests.length > 0 && currentPerms?.admin?.manage_requests && (
                    <div className="flex items-center gap-3 bg-stone-50 p-2 rounded-xl border border-stone-200 w-full sm:w-auto">
                      <label className="flex items-center gap-2 px-2 cursor-pointer group">
                        <input type="checkbox" checked={selectedRequests.length === pendingRequests.length && pendingRequests.length > 0} onChange={handleSelectAll} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider group-hover:text-amber-700 transition-colors">Selecionar Todos</span>
                      </label>
                      
                      {selectedRequests.length > 0 && (
                        <div className="flex gap-2 border-l border-stone-200 pl-3">
                          <button disabled={actionLoading} onClick={handleBulkReject} className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors disabled:opacity-50">Recusar ({selectedRequests.length})</button>
                          <button disabled={actionLoading} onClick={handleBulkApprove} className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"><CheckSquare size={14} /> Aprovar ({selectedRequests.length})</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl bg-stone-50/50">Nenhuma solicitação pendente no momento.</div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map(req => (
                      <label key={req.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5 border rounded-2xl gap-4 transition-colors ${currentPerms?.admin?.manage_requests ? 'cursor-pointer' : 'cursor-default'} ${selectedRequests.includes(req.id) ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-stone-200 hover:border-amber-200 shadow-sm'}`}>
                        <div className="flex items-center gap-4">
                          {currentPerms?.admin?.manage_requests && (
                            <input type="checkbox" checked={selectedRequests.includes(req.id)} onChange={() => toggleSelectOne(req.id)} className="w-5 h-5 accent-amber-600 rounded cursor-pointer shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-stone-800 text-base">{req.user?.full_name || 'Usuário Desconhecido'}</p>
                            <p className="text-xs text-stone-500 font-medium mt-0.5">{req.user?.whatsapp} • Solicitado em {new Date(req.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        
                        {/* Se tem permissão de gerenciar, mostra os botões individuais */}
                        {selectedRequests.length === 0 && currentPerms?.admin?.manage_requests && (
                          <div className="flex gap-2 w-full sm:w-auto pl-9 sm:pl-0">
                            <button disabled={actionLoading} onClick={(e) => { e.preventDefault(); handleRejectRequest(req.id); }} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-stone-200 text-red-600 hover:bg-red-50 hover:border-red-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"><XCircle size={16} /> Recusar</button>
                            <button disabled={actionLoading} onClick={(e) => { e.preventDefault(); handleApproveRequest(req.id, req.user_id); }} className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1 disabled:opacity-50"><CheckCircle size={16} /> Aprovar</button>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {resolvedRequests.length > 0 && (
                <div className="space-y-4 animate-in fade-in">
                  <h3 className="font-bold text-lg text-stone-800 border-b border-stone-100 pb-4 flex items-center gap-2">
                    <Clock size={20} className="text-stone-400" /> Histórico de Solicitações
                  </h3>
                  
                  <div className="space-y-3 opacity-80">
                    {resolvedRequests.map(req => (
                      <div key={req.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-stone-50 border border-stone-200 rounded-2xl gap-4">
                        <div>
                          <p className="font-bold text-stone-600 text-sm">{req.user?.full_name || 'Usuário Desconhecido'}</p>
                          <p className="text-xs text-stone-400">{req.user?.whatsapp} • Solicitado em {new Date(req.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === 'approved' ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg"><CheckCircle size={14} /> Aprovado por {req.resolver?.full_name?.split(' ')[0] || 'Admin'} em {new Date(req.resolved_at).toLocaleDateString('pt-BR')}</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg"><XCircle size={14} /> Recusado por {req.resolver?.full_name?.split(' ')[0] || 'Admin'} em {new Date(req.resolved_at).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: MEMBROS */}
          {activeTab === 'members' && hasMembersAccess && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="font-bold text-lg text-stone-800 mb-4">Comunidade</h3>
              
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="py-4 px-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Nome do Membro</th>
                      <th className="py-4 px-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Contato</th>
                      <th className="py-4 px-5 text-xs font-bold text-stone-500 uppercase tracking-wider">Nível de Acesso (Cargo)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {members.map(member => (
                      <tr key={member.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="py-4 px-5 font-bold text-stone-800 text-sm">{member.full_name}</td>
                        <td className="py-4 px-5 text-sm text-stone-600 font-medium">{member.whatsapp}</td>
                        <td className="py-4 px-5">
                          {currentPerms?.admin?.manage_members ? (
                            <select 
                              value={`${member.role}|${member.custom_role_id || ''}`} 
                              onChange={(e) => {
                                const [baseRole, customId] = e.target.value.split('|');
                                handleChangeMemberRole(member.id, baseRole, customId || null);
                              }}
                              className="bg-white border border-stone-200 text-sm font-bold text-stone-700 rounded-xl px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer shadow-sm"
                            >
                              <optgroup label="Acessos Base">
                                <option value="membro|">Membro</option>
                                <option value="admin|">Administrador Master</option>
                              </optgroup>
                              {roles.length > 0 && (
                                <optgroup label="Cargos Personalizados">
                                  {roles.map(r => (
                                    <option key={r.id} value={`lider|${r.id}`}>{r.name}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          ) : (
                            <span className="text-sm font-bold text-stone-600">
                              {member.role === 'admin' ? 'Admin Master' : member.role === 'lider' ? member.custom_role?.name : 'Membro'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: CARGOS E PERMISSÕES (NOVA MATRIZ GRANULAR) */}
          {activeTab === 'roles' && hasRolesAccess && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-stone-800">Gerenciar Perfis</h3>
                {!showRoleForm && currentPerms?.admin?.manage_roles && (
                  <button onClick={() => handleOpenRoleForm()} className="px-5 py-2.5 bg-stone-900 text-white text-sm font-bold rounded-xl hover:bg-stone-800 transition-colors flex items-center shadow-sm gap-2">
                    <Plus size={16} /> Novo Cargo
                  </button>
                )}
              </div>

              {showRoleForm ? (
                <form onSubmit={handleSaveRole} className="bg-stone-50 p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-inner">
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nome do Cargo</label>
                    <input 
                      type="text" 
                      value={roleName} 
                      onChange={e => setRoleName(e.target.value)} 
                      placeholder="Ex: Tesoureiro, Diácono, Líder de Célula..." 
                      disabled={editingRoleId === 'native_membro'}
                      required 
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:bg-stone-100 disabled:text-stone-400 font-medium text-stone-800 shadow-sm" 
                    />
                  </div>
                  
                  <div className="mb-8">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">Permissões Especiais (Matriz de Acesso)</label>
                    
                    {/* NOVO LAYOUT DE GRID PARA PERMISSÕES GRANULARES */}
                    <div className="space-y-4">
                      {PERMISSIONS_SCHEMA.map(mod => (
                        <div key={mod.module} className="border border-stone-200 rounded-2xl p-5 bg-white shadow-sm">
                          <h4 className="font-bold text-stone-800 mb-4 text-sm tracking-tight border-b border-stone-100 pb-2">{mod.label}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-y-3 gap-x-4">
                            {mod.actions.map(act => (
                              <label key={act.key} className="flex items-center gap-2.5 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={permissions[mod.module]?.[act.key] || false}
                                  onChange={() => handlePermissionChange(mod.module, act.key)}
                                  className="w-4 h-4 accent-amber-600 rounded border-stone-300 cursor-pointer transition-all" 
                                />
                                <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900 transition-colors">{act.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-stone-200">
                    <button type="button" onClick={() => setShowRoleForm(false)} className="px-6 py-3 bg-white border border-stone-200 text-stone-600 font-bold rounded-xl hover:bg-stone-100 transition-colors">Cancelar</button>
                    <button type="submit" className="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl shadow-md hover:bg-amber-700 transition-colors">Salvar Alterações</button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* CARD FIXO: ADMINISTRADOR MASTER */}
                  <div className="bg-stone-900 border border-stone-800 p-6 rounded-3xl flex justify-between items-start shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-2 -translate-y-4">
                      <Lock size={100} />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-white text-lg mb-1">Administrador Master</h4>
                      <p className="text-xs text-stone-400 font-medium mb-3">Perfil nativo inalterável</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-stone-800 border border-stone-700 text-stone-300 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Acesso Total (Ilimitado)</span>
                      </div>
                    </div>
                  </div>

                  {/* CARD FIXO: MEMBRO COMUM */}
                  <div className="bg-white border border-stone-200 p-6 rounded-3xl flex justify-between items-start shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
                    <div className="relative z-10">
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Membro</h4>
                      <p className="text-xs text-stone-400 font-medium mb-3">Perfil nativo do sistema</p>
                      <div className="flex flex-wrap gap-2">
                        {renderPermissionBadges(memberPermissions)}
                      </div>
                    </div>
                    {currentPerms?.admin?.manage_roles && (
                      <div className="flex gap-2 relative z-10">
                        <button onClick={() => handleOpenRoleForm(null, true)} className="text-stone-400 hover:text-amber-600 bg-stone-50 hover:bg-amber-50 p-2 rounded-xl transition-colors"><Edit3 size={18} /></button>
                      </div>
                    )}
                  </div>

                  {/* CARGOS PERSONALIZADOS */}
                  {roles.map(role => (
                    <div key={role.id} className="bg-white border border-stone-200 p-6 rounded-3xl flex justify-between items-start hover:border-amber-300 transition-colors group shadow-sm">
                      <div>
                        <h4 className="font-bold text-stone-800 text-lg mb-1">{role.name}</h4>
                        <p className="text-xs text-stone-400 font-medium mb-3">Cargo Personalizado</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {renderPermissionBadges(role.permissions as RolePermissions)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {currentPerms?.admin?.manage_roles && (
                          <button onClick={() => handleOpenRoleForm(role)} className="text-stone-400 hover:text-amber-600 bg-stone-50 hover:bg-amber-50 p-2 rounded-xl transition-colors"><Edit3 size={18} /></button>
                        )}
                        {currentPerms?.admin?.manage_roles && (
                          <button onClick={() => handleDeleteRole(role.id)} className="text-stone-400 hover:text-red-500 bg-stone-50 hover:bg-red-50 p-2 rounded-xl transition-colors"><Trash2 size={18} /></button>
                        )}
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