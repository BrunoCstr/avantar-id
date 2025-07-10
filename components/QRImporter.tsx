"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, Camera, FileImage, AlertCircle, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Html5QrcodeScanner } from "html5-qrcode"

interface ImportedSecret {
  name: string
  secret: string
  issuer?: string
  type: 'TOTP' | 'HOTP'
  algorithm?: string
  digits?: number
  period?: number
}

interface QRImporterProps {
  isOpen: boolean
  onClose: () => void
  onImport: (secrets: Array<{ name: string; fullName: string; secret: string; color: string }>) => void
}

export function QRImporter({ isOpen, onClose, onImport }: QRImporterProps) {
  const [step, setStep] = useState<'upload' | 'scan' | 'select'>('upload')
  const [importedSecrets, setImportedSecrets] = useState<ImportedSecret[]>([])
  const [selectedSecrets, setSelectedSecrets] = useState<Set<number>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const { toast } = useToast()

  // Função para decodificar Base64 para Uint8Array
  const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  // Função para decodificar URL do Google Authenticator ou otpauth individual
  const decodeQRCode = (url: string): ImportedSecret[] => {
    try {
      // Verificar se é um QR code de exportação do Google Authenticator
      if (url.startsWith('otpauth-migration://offline?data=')) {
        return decodeGoogleAuthURL(url)
      }
      
      // Verificar se é uma URL otpauth individual
      if (url.startsWith('otpauth://')) {
        return [decodeOtpauthURL(url)]
      }

      throw new Error('Formato de QR code não reconhecido. Suporte para otpauth:// e exportação do Google Authenticator.')
    } catch (error) {
      console.error('Erro ao decodificar URL:', error)
      throw error
    }
  }

  // Função para decodificar URL otpauth individual
  const decodeOtpauthURL = (url: string): ImportedSecret => {
    const urlObj = new URL(url)
    
    // Extrair tipo (totp ou hotp)
    const type = urlObj.protocol.replace(':', '').replace('otpauth', '').replace('//', '') || 'totp'
    
    // Extrair label (contém issuer:account ou apenas account)
    const pathname = decodeURIComponent(urlObj.pathname.substring(1))
    const [issuer, account] = pathname.includes(':') 
      ? pathname.split(':')
      : [urlObj.searchParams.get('issuer') || '', pathname]

    // Extrair secret
    const secret = urlObj.searchParams.get('secret')
    if (!secret) {
      throw new Error('Secret não encontrado na URL otpauth')
    }

    // Extrair outros parâmetros
    const digits = parseInt(urlObj.searchParams.get('digits') || '6')
    const period = parseInt(urlObj.searchParams.get('period') || '30')
    const algorithm = urlObj.searchParams.get('algorithm') || 'SHA1'

    return {
      name: account || issuer,
      secret: secret,
      issuer: issuer || undefined,
      type: type.toUpperCase() as 'TOTP' | 'HOTP',
      algorithm,
      digits,
      period
    }
  }

  // Função para decodificar URL do Google Authenticator
  const decodeGoogleAuthURL = (url: string): ImportedSecret[] => {
    try {
      const dataParam = url.split('data=')[1]
      if (!dataParam) {
        throw new Error('Dados não encontrados no QR code.')
      }

      // Decodificar URL encoding
      const decodedData = decodeURIComponent(dataParam)
      
      // Decodificar Base64
      const binaryData = base64ToUint8Array(decodedData)
      
      // Parsear dados protobuf
      return parseProtobufData(binaryData)
    } catch (error) {
      console.error('Erro ao decodificar URL do Google Authenticator:', error)
      throw error
    }
  }

  // Função melhorada para parsear dados protobuf do Google Authenticator
  const parseProtobufData = (data: Uint8Array): ImportedSecret[] => {
    const secrets: ImportedSecret[] = []
    let pos = 0

    try {
      // Buscar por entradas de OTP
      while (pos < data.length - 10) {
        // Buscar por padrão de início de entry (geralmente 0x0A seguido de comprimento)
        if (data[pos] === 0x0A) {
          const entryLength = data[pos + 1]
          if (entryLength > 0 && entryLength < 200 && pos + entryLength + 2 <= data.length) {
            const entryData = data.slice(pos + 2, pos + 2 + entryLength)
            const secret = parseOTPEntry(entryData)
            if (secret) {
              secrets.push(secret)
            }
            pos += entryLength + 2
          } else {
            pos++
          }
        } else {
          pos++
        }
      }

      // Se não encontrou nada com o método acima, tentar método alternativo
      if (secrets.length === 0) {
        return parseProtobufAlternative(data)
      }
    } catch (error) {
      console.error('Erro ao parsear protobuf:', error)
      // Tentar método alternativo se houver erro
      return parseProtobufAlternative(data)
    }

    return secrets
  }

  // Método alternativo para parsear protobuf (mais genérico)
  const parseProtobufAlternative = (data: Uint8Array): ImportedSecret[] => {
    const secrets: ImportedSecret[] = []
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data)
    
    // Buscar por padrões de base32 (secrets típicos)
    const base32Regex = /[A-Z2-7]{16,}/g
    const secretMatches = text.match(base32Regex) || []
    
    // Buscar por nomes/issuers (texto legível)
    const textMatches = text.match(/[a-zA-Z0-9\s@.-]{3,30}/g) || []
    
    // Tentar combinar secrets com nomes
    secretMatches.forEach((secret, index) => {
      if (secret.length >= 16) {
        const name = textMatches[index] || textMatches[index * 2] || `Importado ${index + 1}`
        secrets.push({
          name: name.trim(),
          secret: secret,
          type: 'TOTP'
        })
      }
    })

    return secrets
  }

  // Função para parsear entrada individual de OTP do protobuf
  const parseOTPEntry = (data: Uint8Array): ImportedSecret | null => {
    try {
      let pos = 0
      let secret = ''
      let name = ''
      let issuer = ''

      while (pos < data.length - 1) {
        const tag = data[pos] & 0x07
        const wireType = (data[pos] & 0x78) >> 3

        if (wireType === 2) { // String
          const length = data[pos + 1]
          if (length > 0 && pos + 2 + length <= data.length) {
            const str = new TextDecoder('utf-8').decode(data.slice(pos + 2, pos + 2 + length))
            
            // Tentar identificar o tipo de string baseado no conteúdo
            if (str.match(/^[A-Z2-7]{16,}$/)) {
              secret = str
            } else if (str.length > 0 && str.length < 50) {
              if (!name) name = str
              else if (!issuer) issuer = str
            }
            
            pos += 2 + length
          } else {
            pos++
          }
        } else {
          pos++
        }
      }

      if (secret && name) {
        return {
          name: name,
          secret: secret,
          issuer: issuer || undefined,
          type: 'TOTP'
        }
      }
    } catch (error) {
      console.error('Erro ao parsear entrada OTP:', error)
    }

    return null
  }

  // Função para processar QR code decodificado
  const processQRCode = useCallback((decodedText: string) => {
    setIsProcessing(true)
    setError(null)

    try {
      const secrets = decodeQRCode(decodedText)
      
      if (secrets.length === 0) {
        throw new Error('Nenhum secret encontrado no QR code.')
      }

      setImportedSecrets(secrets)
      setSelectedSecrets(new Set(secrets.map((_, index) => index)))
      setStep('select')
      
      toast({
        title: "QR Code lido com sucesso!",
        description: `Encontrados ${secrets.length} secret(s) para importar`,
      })
    } catch (error: any) {
      setError(error.message)
      toast({
        title: "Erro ao processar QR Code",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [toast])

  // Função para upload de arquivo
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setError(null)

    try {
      // Usar html5-qrcode para processar arquivo
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5QrCode = new Html5Qrcode("qr-reader")
      
      const result = await html5QrCode.scanFile(file, true)
      processQRCode(result)
    } catch (error: any) {
      setError('Erro ao ler QR code do arquivo. Verifique se a imagem contém um QR code válido.')
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível encontrar um QR code válido na imagem",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Função para iniciar scanner da câmera
  const startCameraScanner = () => {
    setStep('scan')
    setError(null)
    
    setTimeout(() => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }

      scannerRef.current = new Html5QrcodeScanner(
        "qr-scanner",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true
        },
        false
      )

      scannerRef.current.render(
        (decodedText) => {
          processQRCode(decodedText)
          scannerRef.current?.clear()
        },
        (error) => {
          // Ignorar erros de scan contínuo
        }
      )
    }, 100)
  }

  // Função para importar secrets selecionados
  const handleImport = () => {
    const secretsToImport = Array.from(selectedSecrets).map(index => {
      const secret = importedSecrets[index]
      return {
        name: secret.issuer || secret.name,
        fullName: `${secret.issuer || secret.name} (Importado)`,
        secret: secret.secret,
        color: '#6600CC'
      }
    })

    onImport(secretsToImport)
    handleClose()
    
    toast({
      title: "Importação concluída!",
      description: `${secretsToImport.length} seguradora(s) importada(s) com sucesso`,
    })
  }

  // Função para fechar modal
  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
    }
    setStep('upload')
    setImportedSecrets([])
    setSelectedSecrets(new Set())
    setError(null)
    setIsProcessing(false)
    onClose()
  }

  // Função para toggle seleção
  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedSecrets)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSecrets(newSelected)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar QR Code do Google Authenticator</DialogTitle>
          <DialogDescription>
            Importe seus secrets existentes do Google Authenticator usando o QR code de exportação.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Upload de arquivo */}
              <div className="space-y-4">
                <Label className="text-center block">Upload de Imagem</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <FileImage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Imagem
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    PNG, JPG ou JPEG
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Scanner da câmera */}
              <div className="space-y-4">
                <Label className="text-center block">Scanner da Câmera</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <Button
                    variant="outline"
                    onClick={startCameraScanner}
                    disabled={isProcessing}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Usar Câmera
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Escaneie o QR code
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3">Tipos de QR Code suportados:</h4>
              
              <div className="space-y-3">
                <div>
                  <h5 className="font-medium text-blue-800 mb-1">📱 Exportação do Google Authenticator (múltiplos):</h5>
                  <ol className="text-sm text-blue-700 space-y-1 ml-4">
                    <li>1. Abra o Google Authenticator</li>
                    <li>2. Toque nos três pontos (⋮) no canto superior direito</li>
                    <li>3. Selecione "Exportar contas"</li>
                    <li>4. Escolha as contas que deseja exportar</li>
                    <li>5. Toque em "Avançar"</li>
                    <li>6. Use a câmera ou salve a imagem do QR code</li>
                  </ol>
                </div>

                <div>
                  <h5 className="font-medium text-blue-800 mb-1">🔗 QR Code individual (otpauth://):</h5>
                  <p className="text-sm text-blue-700 ml-4">
                    Funciona com QR codes gerados por qualquer aplicativo 2FA ou serviço que use o padrão otpauth://
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Posicione o QR code na câmera</h3>
              <p className="text-sm text-gray-500 mb-4">
                Mantenha o QR code bem enquadrado e iluminado
              </p>
            </div>
            
            <div id="qr-scanner" className="mx-auto max-w-md"></div>
            
            <div className="text-center">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">QR code processado com sucesso! Selecione os secrets para importar:</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {importedSecrets.map((secret, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedSecrets.has(index)}
                    onCheckedChange={() => toggleSelection(index)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {secret.issuer || secret.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Secret: {secret.secret.substring(0, 8)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm text-gray-500">
              {selectedSecrets.size} de {importedSecrets.length} secret(s) selecionado(s)
            </div>
          </div>
        )}

        <div id="qr-reader" className="hidden"></div>

        <DialogFooter>
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={selectedSecrets.size === 0}
              >
                Importar {selectedSecrets.size} Secret(s)
              </Button>
            </>
          )}
          {step !== 'select' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 