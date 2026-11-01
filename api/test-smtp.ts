import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    body = body || {};

    const { smtpHost, smtpPort, smtpUser, smtpPass, recipient } = body;
    let user = smtpUser;
    let pass = smtpPass;

    if (!pass || !user) {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'studio'));
        if (configDoc.exists()) {
          const d = configDoc.data();
          pass = pass || d?.smtpPass;
          user = user || d?.smtpUser || d?.adminEmail;
        }
      } catch (err) {
        console.warn('Could not read config from Firestore in test-smtp:', err);
      }
    }

    user = user || 'yayphotostudio@gmail.com';

    if (!pass) {
      return res.status(400).json({
        success: false,
        error: 'Sandi Aplikasi Gmail (16 karakter) belum diisi. Masukkan 16 karakter dari myaccount.google.com/apppasswords.',
      });
    }

    const host = smtpHost || 'smtp.gmail.com';
    const port = Number(smtpPort || 465);
    const targetRecipient = recipient || user || 'yayphotostudio@gmail.com';

    const testTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: String(user).trim(),
        pass: String(pass).trim(),
      },
    });

    await testTransporter.verify();

    let studioAddr = '';
    try {
      const configDoc = await getDoc(doc(db, 'config', 'studio'));
      if (configDoc.exists()) {
        studioAddr = configDoc.data()?.address || '';
      }
    } catch {}

    await testTransporter.sendMail({
      from: `"Yay Photo Studio Test" <${String(user).trim()}>`,
      to: targetRecipient,
      subject: '[Tes Sistem] Koneksi Email Yay Photo Studio Berhasil!',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669; margin-top: 0;">🎉 Koneksi Email Otomatis Berhasil!</h2>
          <p>Halo Admin Yay Photo Studio,</p>
          <p>Ini adalah pesan konfirmasi uji coba. Server email studio Anda telah terhubung dengan sempurna ke <strong>${targetRecipient}</strong>.</p>
          <p>Mulai sekarang, setiap ada pelanggan yang melakukan reservasi baru di website, email pemberitahuan otomatis akan langsung masuk ke inbox Anda dan inbox customer tanpa perlu menekan tombol apapun.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">Yay Photo Studio${studioAddr ? ` · ${studioAddr}` : ''}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Email uji coba berhasil dikirim ke ${targetRecipient}! Silakan cek kotak masuk email Anda.`,
    });
  } catch (err: any) {
    console.error('SMTP test failure in api/test-smtp:', err);
    let errMsg = err.message || 'Gagal mengirim email uji coba.';
    if (errMsg.includes('534') || errMsg.includes('Application-specific password') || errMsg.includes('InvalidSecondFactor')) {
      errMsg = 'Google mewajibkan "Sandi Aplikasi" (App Password 16 karakter), bukan password akun Gmail biasa. Silakan buat sandi aplikasi di myaccount.google.com/apppasswords.';
    } else if (errMsg.includes('Invalid login') || errMsg.includes('Username and Password not accepted')) {
      errMsg = 'Email akun atau Sandi Aplikasi Gmail ditolak. Pastikan Anda memasukkan Sandi Aplikasi 16 karakter dari myaccount.google.com/apppasswords.';
    }
    return res.status(400).json({
      success: false,
      error: errMsg,
    });
  }
}
