import { render, screen, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../../src/screens/LoginScreen';
import * as auth from '../../src/services/auth';

jest.mock('../../src/services/auth', () => ({
  loginUser: jest.fn(),
  resetPassword: jest.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'Alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (global.Alert as any).mockRestore();
  });

  it('renders logo, title, subtitle, inputs and button', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('♀♂')).toBeTruthy();
    expect(screen.getByText('Relaxy')).toBeTruthy();
    expect(screen.getByText('Sua rede social privada')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Senha')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('Esqueci minha senha')).toBeTruthy();
  });

  it('shows alert when email is empty on login', async () => {
    await render(<LoginScreen />);
    fireEvent.press(screen.getByText('Entrar'));
    expect(global.Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
  });

  it('shows alert when password is empty on login', async () => {
    await render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@rilaxy.com');
    fireEvent.press(screen.getByText('Entrar'));
    expect(global.Alert.alert).toHaveBeenCalledWith('Erro', 'Preencha todos os campos');
  });

  it('calls loginUser with email and password', async () => {
    await render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@rilaxy.com');
    fireEvent.changeText(screen.getByPlaceholderText('Senha'), 'password123');
    fireEvent.press(screen.getByText('Entrar'));
    expect(auth.loginUser).toHaveBeenCalledWith('test@rilaxy.com', 'password123');
  });

  it('shows loading state while logging in', async () => {
    (auth.loginUser as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    await render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@rilaxy.com');
    fireEvent.changeText(screen.getByPlaceholderText('Senha'), 'password123');
    fireEvent.press(screen.getByText('Entrar'));
    expect(screen.getByText('Entrando...')).toBeTruthy();
  });

  it('calls resetPassword when forgot password is pressed with email', async () => {
    await render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@rilaxy.com');
    fireEvent.press(screen.getByText('Esqueci minha senha'));
    expect(auth.resetPassword).toHaveBeenCalledWith('test@rilaxy.com');
  });

  it('shows alert on forgot password when email is empty', async () => {
    await render(<LoginScreen />);
    fireEvent.press(screen.getByText('Esqueci minha senha'));
    expect(global.Alert.alert).toHaveBeenCalledWith('Erro', 'Digite seu email primeiro');
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('shows error alert on login failure', async () => {
    (auth.loginUser as jest.Mock).mockRejectedValueOnce(new Error('Credenciais inválidas'));
    await render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'test@rilaxy.com');
    fireEvent.changeText(screen.getByPlaceholderText('Senha'), 'wrong');
    fireEvent.press(screen.getByText('Entrar'));
    await (global as any).flushPromises?.() || new Promise(setImmediate);
    expect(global.Alert.alert).toHaveBeenCalledWith('Erro', 'Credenciais inválidas');
  });
});
