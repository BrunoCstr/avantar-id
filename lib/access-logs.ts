import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore'
import { db } from './firebase'

// Interface para dados de localização
interface LocationData {
  country?: string
  region?: string
  city?: string
  timezone?: string
  isp?: string
  org?: string
  as?: string
}

// Interface para log de acesso
export interface AccessLog {
  id?: string
  userId: string
  userEmail: string
  userRole: string
  ipAddress: string
  userAgent: string
  location: LocationData
  timestamp: string
  sessionId: string
  action: 'login' | 'logout' | 'access_dashboard' | 'admin_action'
  additionalData?: Record<string, any>
}

// Função para obter IP e localização do usuário
export async function getUserLocationData(): Promise<{ ip: string, location: LocationData }> {
  try {
    // Primeiro, obter o IP
    const ipResponse = await fetch('https://api.ipify.org?format=json')
    const ipData = await ipResponse.json()
    const ip = ipData.ip

    // Depois, obter dados de localização baseados no IP
    const locationResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,timezone,isp,org,as,query`)
    const locationData = await locationResponse.json()

    if (locationData.status === 'success') {
      return {
        ip,
        location: {
          country: locationData.country,
          region: locationData.regionName,
          city: locationData.city,
          timezone: locationData.timezone,
          isp: locationData.isp,
          org: locationData.org,
          as: locationData.as
        }
      }
    } else {
      // Fallback se a API falhar
      return {
        ip,
        location: {
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown'
        }
      }
    }
  } catch (error) {
    console.error('Erro ao obter dados de localização:', error)
    // Fallback em caso de erro
    return {
      ip: 'Unknown',
      location: {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown'
      }
    }
  }
}

// Função para registrar log de acesso
export async function logUserAccess(
  userId: string,
  userEmail: string,
  userRole: string,
  action: AccessLog['action'],
  additionalData?: Record<string, any>
): Promise<void> {
  try {
    const { ip, location } = await getUserLocationData()
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    const sessionId = generateSessionId()

    const accessLog: Omit<AccessLog, 'id'> = {
      userId,
      userEmail,
      userRole,
      ipAddress: ip,
      userAgent,
      location,
      timestamp: new Date().toISOString(),
      sessionId,
      action,
      ...(additionalData && Object.keys(additionalData).length > 0 ? { additionalData } : {})
    }

    await addDoc(collection(db, 'access-logs'), accessLog)
    console.log('Log de acesso registrado:', { action, userId, ip })
  } catch (error) {
    console.error('Erro ao registrar log de acesso:', error)
    // Não falhar a aplicação se o log falhar
  }
}

// Função para obter logs de acesso (apenas para admins)
export async function getAccessLogs(limitCount: number = 100): Promise<AccessLog[]> {
  try {
    const logsQuery = query(
      collection(db, 'access-logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    
    const querySnapshot = await getDocs(logsQuery)
    const logs: AccessLog[] = []
    
    querySnapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      } as AccessLog)
    })
    
    return logs
  } catch (error) {
    console.error('Erro ao obter logs de acesso:', error)
    return []
  }
}

// Função para obter logs de um usuário específico
export async function getUserAccessLogs(userId: string, limitCount: number = 50): Promise<AccessLog[]> {
  try {
    const logsQuery = query(
      collection(db, 'access-logs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    
    const querySnapshot = await getDocs(logsQuery)
    const logs: AccessLog[] = []
    
    querySnapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      } as AccessLog)
    })
    
    return logs
  } catch (error) {
    console.error('Erro ao obter logs do usuário:', error)
    return []
  }
}

// Função para gerar um ID de sessão único
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Função para registrar ações específicas de admin
export async function logAdminAction(
  userId: string,
  userEmail: string,
  action: string,
  targetCompany?: string,
  additionalData?: Record<string, any>
): Promise<void> {
  await logUserAccess(
    userId,
    userEmail,
    'admin',
    'admin_action',
    {
      adminAction: action,
      targetCompany,
      ...additionalData
    }
  )
} 