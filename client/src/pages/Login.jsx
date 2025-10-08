import { useState } from 'react'
import { Form, TextInput, Button, InlineNotification } from '@carbon/react'
import { api } from '../services/api'
import { setUser } from '../services/session'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  async function submit(e){
    e.preventDefault()
    setErr('')
    try {
      const { user } = await api.login(email)
      setUser(user)
      nav('/kyc')
    } catch (e) {
      setErr('Login failed')
    }
  }

  return (
    <div className="container" style={{ maxWidth: 440, marginTop: '6rem' }}>
      <Form onSubmit={submit}>
        <h2>Sign in</h2>
        <TextInput id="email" labelText="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <Button type="submit" style={{ marginTop: '1rem' }}>Continue</Button>
        {err && <InlineNotification title="Error" subtitle={err} kind="error" lowContrast />}
      </Form>
    </div>
  )
}
