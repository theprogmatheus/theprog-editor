# Pasta de Certificados SSL/TLS

Esta pasta é montada dentro do container Docker em `/etc/nginx/certs/`.

Para que o Nginx inicie com sucesso com HTTPS nativo, certifique-se de que os seguintes arquivos existam nesta pasta:
- `cert.pem`: Certificado SSL público (ou Certificado de Origem do Cloudflare)
- `key.pem`: Chave privada do certificado SSL

> **Atenção:** Os arquivos `.pem`, `.crt` e `.key` estão configurados no `.gitignore` para nunca serem enviados acidentalmente para o repositório Git público.
