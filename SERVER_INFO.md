# EcoHealth - Server Information

This document contains the necessary information for the EcoHealth production/staging backend on AWS Lightsail.

## Server Details
- **Hosting Provider:** Amazon Web Services (AWS) Lightsail
- **Operating System:** Ubuntu 22.04 LTS
- **Public IPv4 Address:** `52.58.30.77`
- **Username:** `ubuntu`
- **SSH Key Used:** `id_ed25519_ecohealth` (You must have this private key on your machine to connect)

## Connection Instructions

### Connecting directly via Terminal
If you have the `id_ed25519_ecohealth` key loaded on your machine, you can connect using:
```bash
ssh -i ~/.ssh/id_ed25519_ecohealth ubuntu@52.58.30.77
```

### Future Network Configuration Requirements (AWS Console)
To make this server work properly for web traffic, the Lead Developer (Can) will need to configure the following in the **Networking** tab of the AWS Lightsail Panel:
1. **Static IP:** Attach a Static IP so the address doesn't change when the server reboots.
2. **Firewall Rules:** 
   - Open Port `80` (HTTP)
   - Open Port `443` (HTTPS)
   - Keep Port `22` (SSH) open for remote access.
