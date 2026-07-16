---
alwaysApply: false
description: after each changes
scene: git_message
---
Write your rules here to customize the style of AI-generated commit messages.
feat(firebase): add firebase admin and frontend SDK setup files

Create root-level firebaseAdmin.js for server-side Firebase Admin SDK initialization using the service account key. Add frontend/src/utils/firebase.js that initializes the web Firebase SDK with the project's web app configuration, then exports auth, Firestore, and storage services.