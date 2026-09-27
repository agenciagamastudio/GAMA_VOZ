export function useAuthAPI() {
  const getToken = () => localStorage.getItem('gama_voz_token')

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getToken()

    if (!token) {
      throw new Error('Não autenticado')
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    // Sessão expirada/inválida: derruba a sessão local e volta pro login
    // em vez de deixar cada tela mostrar "Token expirado" isoladamente.
    if (response.status === 401) {
      localStorage.removeItem('gama_voz_token')
      localStorage.removeItem('gama_voz_user')
      window.location.reload()
      throw new Error('Sessão expirada — faça login novamente')
    }

    return response
  }

  return { fetchWithAuth, getToken }
}
