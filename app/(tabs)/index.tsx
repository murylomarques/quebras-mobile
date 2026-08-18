import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type Step = "identification" | "service" | "reason" | "evidence" | "complete";
type CameraStatus = "loading" | "ready" | "error";
type GpsSnapshot = { latitude: number; longitude: number; accuracy: number | null; capturedAt: string };
type Reason = { name: string; available: boolean; detail: string };
type ServiceAppointment = { id: string; address: string; serviceType: string; schedule: string };

const reasons: Reason[] = [
  // Motivos liberados: aparecem primeiro para agilizar a operação em campo.
  { name: "COP - Cliente Ausente", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Endereço não localizado", available: true, detail: "Fluxo disponível no MVP" },
  { name: "COP - Sem estrutura/SEM PTR no local", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Equipamento não retirado - Sem contato com cliente", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Cliente cancelou a manutenção", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Condomínio não atendido", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Condomínio Saturado", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Área não atendida", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Área Saturada", available: true, detail: "Fluxo disponível para registro" },
  { name: "COP - Conduíte obstruído", available: true, detail: "Fluxo disponível para registro" },
  // Demais motivos permanecem bloqueados até o cadastramento das regras.
  { name: "COP - Cliente mudou de endereço", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Alteração de Plano", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Migração", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Mudança de Endereço", available: false, detail: "Regras ainda não cadastradas" },
];

const technicianServices: ServiceAppointment[] = [
  { id: "SA-983412", address: "Rua das Palmeiras, 145 • Vila Mariana", serviceType: "Instalação de fibra", schedule: "Hoje • 10:30" },
  { id: "SA-983587", address: "Av. Brasil, 820 • Bela Vista", serviceType: "Reparo de conexão", schedule: "Hoje • 13:00" },
  { id: "SA-984021", address: "Rua Harmonia, 64 • Pinheiros", serviceType: "Mudança de endereço", schedule: "Amanhã • 08:00" },
  { id: "SA-984118", address: "Al. Santos, 1010 • Jardins", serviceType: "Instalação de fibra", schedule: "Amanhã • 14:30" },
  { id: "SA-984233", address: "Rua Vergueiro, 2250 • Aclimação", serviceType: "Reparo de conexão", schedule: "Amanhã • 16:00" },
  { id: "SA-984407", address: "Rua Oscar Freire, 780 • Cerqueira César", serviceType: "Instalação de fibra", schedule: "Quinta-feira • 09:00" },
  { id: "SA-984512", address: "Rua Moema, 318 • Moema", serviceType: "Mudança de endereço", schedule: "Quinta-feira • 11:30" },
];

type EvidenceGuide = {
  title: string;
  subtitle: string;
  points: string[];
  cameraTitle: string;
  cameraSubtitle: string;
  frameHint: string;
  voiceSteps: string[];
};

const reasonEvidenceConfig: Record<string, EvidenceGuide> = {
  "COP - Endereço não localizado": {
    title: "Fachada, placa ou portão",
    subtitle: "Capture a fachada do imóvel ou a placa da rua para comprovar a tentativa no local correto.",
    points: [
      "Foto ampla da fachada ou numeração visível",
      "Placa de identificação da rua ou condomínio",
      "Geolocalização capturada no momento do registro",
      "Registro compatível com o endereço da SA no Salesforce",
    ],
    cameraTitle: "Enquadre a fachada ou placa",
    cameraSubtitle: "Mantenha o número do imóvel ou a placa da rua visível na moldura.",
    frameHint: "alinhe a fachada ou placa",
    voiceSteps: [
      "Mostre a fachada da casa ou o portão.",
      "Aproxime o celular para encontrar o número do imóvel.",
      "Afaste o celular até enquadrar toda a fachada.",
      "Confira se o número ou a placa da rua está visível.",
    ],
  },
  default: {
    title: "Evidência técnica de campo",
    subtitle: "Fotografe o local da ocorrência para auditoria e encerramento da SA.",
    points: [
      "Foto clara do obstáculo ou ponto de atendimento",
      "Timestamp e coordenadas geográficas",
      "Registro auditável para o sistema COP",
    ],
    cameraTitle: "Enquadre o local da ocorrência",
    cameraSubtitle: "Mantenha o ponto de atendimento ou obstáculo centralizado.",
    frameHint: "alinhe o ponto de atendimento",
    voiceSteps: [
      "Mostre o ponto da ocorrência ou o obstáculo no local.",
      "Aproxime o celular para registrar o detalhe técnico.",
      "Afaste o celular para mostrar o contexto do atendimento.",
      "Mantenha a câmera firme e confirme que a evidência está nítida.",
    ],
  },
};

const voiceStepsByReason: Record<string, string[]> = {
  "COP - Cliente Ausente": [
    "Mostre a fachada da casa e o portão de entrada.",
    "Aproxime o celular do interfone ou campainha.",
    "Afaste o celular para mostrar a fachada completa.",
    "Confirme que a entrada do imóvel está visível.",
  ],
  "COP - Sem estrutura/SEM PTR no local": [
    "Mostre o ponto onde deveria estar a estrutura ou o PTR.",
    "Aproxime o celular para registrar a ausência ou o obstáculo.",
    "Afaste o celular para mostrar o entorno do local.",
    "Mantenha a imagem firme e bem iluminada.",
  ],
  "COP - Equipamento não retirado - Sem contato com cliente": [
    "Mostre a fachada e o local onde o equipamento deveria ser retirado.",
    "Aproxime o celular para registrar o equipamento ou a ausência dele.",
    "Afaste o celular para identificar o endereço completo.",
    "Confira se a evidência está nítida antes de fotografar.",
  ],
  "COP - Cliente cancelou a manutenção": [
    "Mostre a fachada ou a entrada do imóvel atendido.",
    "Aproxime o celular do local da manutenção.",
    "Afaste o celular para registrar o contexto do atendimento.",
    "Mantenha a câmera firme para concluir a evidência.",
  ],
  "COP - Condomínio não atendido": [
    "Mostre a entrada principal do condomínio.",
    "Aproxime o celular da portaria ou da identificação do condomínio.",
    "Afaste o celular para enquadrar toda a entrada.",
    "Confirme que a identificação do condomínio está legível.",
  ],
  "COP - Condomínio Saturado": [
    "Mostre a entrada ou o ponto de atendimento do condomínio.",
    "Aproxime o celular da estrutura ou do equipamento saturado.",
    "Afaste o celular para mostrar o contexto do local.",
    "Mantenha a evidência nítida e bem enquadrada.",
  ],
  "COP - Área não atendida": [
    "Mostre a rua e a fachada do imóvel atendido.",
    "Aproxime o celular da placa ou do número do endereço.",
    "Afaste o celular para mostrar o entorno da área.",
    "Confira se a localização está claramente identificada.",
  ],
  "COP - Área Saturada": [
    "Mostre a rua e o ponto de atendimento da área.",
    "Aproxime o celular da estrutura ou equipamento relevante.",
    "Afaste o celular para mostrar o contexto da área.",
    "Mantenha a câmera firme e confirme a nitidez da imagem.",
  ],
  "COP - Conduíte obstruído": [
    "Mostre o trecho do conduíte obstruído.",
    "Aproxime o celular para registrar o ponto da obstrução.",
    "Afaste o celular para mostrar o caminho completo do conduíte.",
    "Confira se o obstáculo está visível antes de fotografar.",
  ],
};

const getEvidenceGuide = (reason: string): EvidenceGuide => {
  const baseGuide = reasonEvidenceConfig[reason] || reasonEvidenceConfig.default;
  const customVoiceSteps = voiceStepsByReason[reason];
  return customVoiceSteps ? { ...baseGuide, voiceSteps: customVoiceSteps } : baseGuide;
};

const stepTitle: Record<Step, string> = {
  identification: "Identificação",
  service: "Selecionar SA",
  reason: "Motivo da quebra",
  evidence: "Coleta de evidências",
  complete: "Registro concluído",
};

const stepNumber: Record<Step, string> = {
  identification: "01",
  service: "02",
  reason: "03",
  evidence: "04",
  complete: "05",
};

export default function HomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<Step>("identification");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceAppointment | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [evidenceAdded, setEvidenceAdded] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("loading");
  const [isVoiceGuidanceEnabled, setIsVoiceGuidanceEnabled] = useState(true);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [guidanceText, setGuidanceText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedServiceIds, setCompletedServiceIds] = useState<string[]>([]);
  const [gpsSnapshot, setGpsSnapshot] = useState<GpsSnapshot | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const submitBreakAudit = trpc.breaks.submit.useMutation();
  const existingAuditsQuery = trpc.breaks.listByCsso.useQuery(
    { technicianCsso: username.trim() },
    { enabled: step === "service" && username.trim().length > 0, staleTime: 0 },
  );
  const cameraRef = useRef<CameraView>(null);
  const capturedPhotoRef = useRef<any>(null);
  const filteredServices = useMemo(
    () => technicianServices.filter((service) => `${service.id} ${service.address} ${service.serviceType}`.toLowerCase().includes(serviceSearch.toLowerCase().trim())),
    [serviceSearch],
  );

  const screenProgress = useSharedValue(1);
  const brandPulse = useSharedValue(0);
  const submitSpin = useSharedValue(0);
  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenProgress.value,
    transform: [{ translateY: (1 - screenProgress.value) * 16 }],
  }));
  const brandAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + brandPulse.value * 0.035 }],
  }));
  const submitSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${submitSpin.value}deg` }],
  }));

  useEffect(() => {
    screenProgress.value = 0;
    screenProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [screenProgress, step]);

  useEffect(() => {
    if (isSubmitting) {
      submitSpin.value = 0;
      submitSpin.value = withRepeat(withTiming(360, { duration: 1200, easing: Easing.linear }), -1, false);
    } else {
      submitSpin.value = 0;
    }
    return () => {
      submitSpin.value = 0;
    };
  }, [isSubmitting, submitSpin]);

  useEffect(() => {
    if (!existingAuditsQuery.data) return;
    const syncedIds = existingAuditsQuery.data
      .filter((audit) => audit.status === "completed")
      .map((audit) => audit.serviceAppointmentId);
    if (syncedIds.length > 0) {
      setCompletedServiceIds((current) => [...new Set([...current, ...syncedIds])]);
    }
  }, [existingAuditsQuery.data]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => isSubmitting);
    return () => subscription.remove();
  }, [isSubmitting]);

  useEffect(() => {
    brandPulse.value = withSequence(
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
    );
  }, [brandPulse]);

  useEffect(() => {
    if (!cameraVisible || !isVoiceGuidanceEnabled || cameraStatus === "loading") {
      void Speech.stop();
      return;
    }

    const guide = getEvidenceGuide(selectedReason);
    const prompt = cameraStatus === "error"
      ? "Não consegui abrir a câmera. Verifique a permissão e confira se a lente não está coberta."
      : guide.voiceSteps[guidanceIndex] || guide.voiceSteps[0];

    setGuidanceText(prompt);
    const speakPrompt = async () => {
      await Speech.stop();
      if (cameraVisible && isVoiceGuidanceEnabled) {
        Speech.speak(prompt, { language: "pt-BR", rate: 0.92, pitch: 1, volume: 1 });
      }
    };
    void speakPrompt();

    return () => {
      void Speech.stop();
    };
  }, [cameraVisible, cameraStatus, guidanceIndex, isVoiceGuidanceEnabled, selectedReason]);

  const tapFeedback = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goBack = () => {
    if (isSubmitting) return;
    tapFeedback();
    if (step === "service") setStep("identification");
    if (step === "reason") setStep("service");
    if (step === "evidence") setStep("reason");
    if (step === "complete") setStep("evidence");
  };

  const handleIdentification = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Acesso necessário", "Preencha o usuário CSSO e a senha para continuar.");
      return;
    }
    tapFeedback();
    setStep("service");
  };

  const handleServiceSelection = (service: ServiceAppointment) => {
    if (completedServiceIds.includes(service.id)) return;
    tapFeedback();
    setSelectedService(service);
    setStep("reason");
  };

  const captureGpsSnapshot = async (): Promise<GpsSnapshot | null> => {
    if (Platform.OS === "web") return null;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return null;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const snapshot: GpsSnapshot = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy ?? null,
        capturedAt: new Date(current.timestamp).toISOString(),
      };
      setGpsSnapshot(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  };

  const handleReasonSelection = (reason: Reason) => {
    if (!reason.available) {
      Alert.alert("Motivo indisponível", "As regras deste motivo ainda não foram mapeadas no sistema.");
      return;
    }
    tapFeedback();
    setSelectedReason(reason.name);
    setStep("evidence");
  };

  const handleOpenCamera = async () => {
    tapFeedback();
    if (Platform.OS === "web") {
      Alert.alert("Modo de demonstração", "A câmera guiada será ativada no app instalado no Android ou iOS.");
      setPhotoUri("demo-photo");
      setEvidenceAdded(true);
      return;
    }
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) {
        Alert.alert("Câmera bloqueada", "Permita o acesso à câmera nas configurações do aparelho para fotografar a evidência.");
        return;
      }
    }
    setCameraStatus("loading");
    setGuidanceIndex(0);
    setGuidanceText("Preparando a câmera...");
    setGpsSnapshot(null);
    setCameraVisible(true);
    void captureGpsSnapshot();
  };

  const handleCameraReady = () => {
    setCameraStatus("ready");
    setGuidanceIndex(0);
    setGuidanceText("Câmera pronta. Aponte para o local indicado.");
  };

  const handleCameraMountError = () => {
    setCameraStatus("error");
    setGuidanceText("Não foi possível abrir a câmera. Verifique a permissão e descubra a lente.");
  };

  const handleToggleVoiceGuidance = () => {
    tapFeedback();
    setIsVoiceGuidanceEnabled((current) => {
      const nextValue = !current;
      if (!nextValue) void Speech.stop();
      return nextValue;
    });
  };

  const handleReplayGuidance = () => {
    tapFeedback();
    const guide = getEvidenceGuide(selectedReason);
    const prompt = cameraStatus === "error"
      ? "A câmera não está disponível. Verifique a permissão e a lente."
      : guide.voiceSteps[guidanceIndex] || guide.voiceSteps[0];
    setGuidanceText(prompt);
    void Speech.stop();
    if (isVoiceGuidanceEnabled) Speech.speak(prompt, { language: "pt-BR", rate: 0.92, pitch: 1, volume: 1 });
  };

  const handleCameraHelp = () => {
    tapFeedback();
    const helpText = cameraStatus === "error"
      ? "A câmera não está disponível. Abra as configurações, permita o acesso à câmera e tente novamente."
      : "Se a imagem estiver escura, descubra a lente e afaste o celular do rosto. Depois aproxime-se até encontrar o número ou o ponto da ocorrência.";
    setGuidanceText(helpText);
    void Speech.stop();
    if (isVoiceGuidanceEnabled) Speech.speak(helpText, { language: "pt-BR", rate: 0.92, pitch: 1, volume: 1 });
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || cameraStatus !== "ready") {
      handleCameraHelp();
      return;
    }
    tapFeedback();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.86, skipProcessing: Platform.OS === "android", base64: false });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setEvidenceAdded(true);
        setCameraVisible(false);
        capturedPhotoRef.current = photo;
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setGuidanceText("Não consegui capturar a foto. Descubra a lente, mantenha o celular firme e tente novamente.");
      if (isVoiceGuidanceEnabled) Speech.speak("Não consegui capturar a foto. Descubra a lente, mantenha o celular firme e tente novamente.", { language: "pt-BR", rate: 0.92, pitch: 1, volume: 1 });
    }
  };

  const handleRetakePhoto = () => {
    setPhotoUri(null);
    setEvidenceAdded(false);
    setCameraVisible(true);
  };

  const handleSubmit = async () => {
    if (!evidenceAdded || !selectedService || !selectedReason) {
      Alert.alert("Evidência necessária", "Adicione a evidência solicitada antes de registrar.");
      return;
    }
    if (isSubmitting) return;

    tapFeedback();
    setIsSubmitting(true);
    try {
      const location = gpsSnapshot ?? (await captureGpsSnapshot());
      if (Platform.OS !== "web" && !location) {
        throw new Error("Não foi possível obter a localização. Ative o GPS e permita o acesso à localização para continuar.");
      }

      let evidenceBase64: string | undefined;
      let evidenceUrl: string | undefined;
      if (photoUri && photoUri !== "demo-photo" && Platform.OS !== "web") {
        evidenceBase64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        evidenceUrl = "demo://evidence";
      }

      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      const lastPhoto = capturedPhotoRef.current;
      if (lastPhoto?.width && lastPhoto?.height) {
        imageWidth = lastPhoto.width;
        imageHeight = lastPhoto.height;
      }

      const response = await submitBreakAudit.mutateAsync({
        serviceAppointmentId: selectedService.id,
        technicianCsso: username.trim(),
        reason: selectedReason,
        evidenceUrl,
        evidenceBase64,
        evidenceMimeType: "image/jpeg",
        latitude: location ? String(location.latitude) : undefined,
        longitude: location ? String(location.longitude) : undefined,
        capturedAt: location?.capturedAt ?? new Date().toISOString(),
        imageWidth,
        imageHeight,
        imageOrientation: lastPhoto?.width && lastPhoto?.height ? (lastPhoto.width > lastPhoto.height ? "landscape" : "portrait") : undefined,
      });

      setAuditId(String(response.auditId));
      setCompletedServiceIds((current) => [...new Set([...current, selectedService.id])]);
      setIsSubmitting(false);
      setStep("complete");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setIsSubmitting(false);
      const message = error instanceof Error ? error.message : "Não foi possível registrar a quebra no backend.";
      Alert.alert("Envio não concluído", message);
    }
  };

  const handleReset = () => {
    tapFeedback();
    setSelectedService(null);
    setSelectedReason("");
    setEvidenceAdded(false);
    setPhotoUri(null);
    setGpsSnapshot(null);
    setAuditId(null);
    setServiceSearch("");
    setStep("service");
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBrandRow}>
        {step !== "identification" && step !== "complete" ? (
              <Pressable
            accessibilityLabel="Voltar"
            disabled={isSubmitting}
            onPress={goBack}
            style={({ pressed }) => [styles.backPressable, isSubmitting && styles.disabledBackPressable, pressed && styles.iconPressed]}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
        <Text style={styles.miniBrand}>DESKTOP</Text>
        <View style={styles.topBarSpacer} />
        <Text style={styles.stepCounter}>{stepNumber[step]} / 05</Text>
      </View>
      <View style={styles.topTitleRow}>
        <Text style={styles.topTitle}>{stepTitle[step]}</Text>
        {step !== "identification" && step !== "complete" ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(Number(stepNumber[step]) / 5) * 100}%` }]} /></View> : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="flex-1" containerClassName="bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
        {cameraVisible && (
          <View style={styles.cameraOverlay}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraView}
              facing="back"
              mode="picture"
              onCameraReady={handleCameraReady}
              onMountError={handleCameraMountError}
            />
            {(() => {
              const config = getEvidenceGuide(selectedReason);
              return (
                <View pointerEvents="none" style={styles.cameraGuideLayer}>
                  <View style={styles.cameraTopCopy}>
                    <Text style={styles.cameraKicker}>EVIDÊNCIA TÉCNICA • {selectedReason.toUpperCase()}</Text>
                    <Text style={styles.cameraTitle}>{config.cameraTitle}</Text>
                    <Text style={styles.cameraSubtitle}>{config.cameraSubtitle}</Text>
                    <View style={styles.cameraReadyPill}>
                      <View style={[styles.cameraReadyDot, { backgroundColor: cameraStatus === "ready" ? "#22c55e" : cameraStatus === "error" ? colors.primary : colors.warning }]} />
                      <Text style={styles.cameraReadyText}>{cameraStatus === "ready" ? "Câmera pronta" : cameraStatus === "error" ? "Verifique a câmera" : "Abrindo câmera"}</Text>
                    </View>
                  </View>
                  <View style={styles.documentFrame}>
                    <View style={[styles.frameCorner, styles.frameTopLeft]} />
                    <View style={[styles.frameCorner, styles.frameTopRight]} />
                    <View style={[styles.frameCorner, styles.frameBottomLeft]} />
                    <View style={[styles.frameCorner, styles.frameBottomRight]} />
                    <View style={styles.frameHint}><MaterialIcons name="camera-alt" size={18} color={colors.background} /><Text style={styles.frameHintText}>{config.frameHint}</Text></View>
                  </View>
                  <View style={styles.cameraBottomCopy}><MaterialIcons name="wb-sunny" size={18} color={colors.warning} /><Text style={styles.cameraBottomText}>{guidanceText || config.voiceSteps[0]}</Text></View>
                </View>
              );
            })()}
            <View style={styles.cameraVoicePanel}>
              <View style={styles.cameraVoiceStatus}>
                <View style={[styles.voiceStatusDot, { backgroundColor: isVoiceGuidanceEnabled ? "#22c55e" : "#9ca3af" }]} />
                <Text style={styles.cameraVoiceLabel}>{isVoiceGuidanceEnabled ? "Assistente ativo" : "Voz desligada"}</Text>
              </View>
              <Pressable
                accessibilityLabel="Repetir orientação da câmera"
                onPress={handleReplayGuidance}
                style={({ pressed }) => [styles.cameraVoiceButton, pressed && styles.iconPressed]}
              >
                <MaterialIcons name="volume-up" size={18} color={colors.background} />
              </Pressable>
              <Pressable
                accessibilityLabel={isVoiceGuidanceEnabled ? "Desligar orientação por voz" : "Ligar orientação por voz"}
                onPress={handleToggleVoiceGuidance}
                style={({ pressed }) => [styles.cameraVoiceButton, pressed && styles.iconPressed]}
              >
                <MaterialIcons name={isVoiceGuidanceEnabled ? "volume-off" : "volume-up"} size={18} color={colors.background} />
              </Pressable>
            </View>
            <View style={styles.cameraControls}>
              <Pressable onPress={() => setCameraVisible(false)} style={({ pressed }) => [styles.cameraCancelButton, pressed && styles.iconPressed]}><Text style={styles.cameraCancelText}>Cancelar</Text></Pressable>
              <Pressable onPress={handleCapturePhoto} style={({ pressed }) => [styles.shutterButton, pressed && styles.shutterPressed]}><View style={styles.shutterInner} /></Pressable>
              <Pressable
                accessibilityLabel="Ajuda da câmera"
                onPress={handleCameraHelp}
                style={({ pressed }) => [styles.cameraHelpButton, pressed && styles.iconPressed]}
              >
                <MaterialIcons name="help-outline" size={20} color={colors.background} />
                <Text style={styles.cameraHelpText}>Ajuda</Text>
              </Pressable>
            </View>
          </View>
        )}
        {renderTopBar()}
        <Animated.View style={[styles.content, screenAnimatedStyle]}>
          {step === "identification" && (
            <ScrollView contentContainerStyle={styles.identificationContent} keyboardShouldPersistTaps="handled">
              <View style={styles.heroBackdrop}>
                <View style={styles.heroCircleLarge} />
                <View style={styles.heroCircleSmall} />
                <Animated.View style={[styles.brandLockup, brandAnimatedStyle]}>
                  <View style={styles.brandIconBox}>
                    <Text style={styles.brandIconText}>D</Text>
                    <View style={styles.brandIconSlash} />
                  </View>
                  <Text style={styles.brandName}>DESKTOP</Text>
                  <Text style={styles.brandDescriptor}>OPERAÇÃO EM CAMPO</Text>
                </Animated.View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroKicker}>QUEBRAS TÉCNICAS</Text>
                  <Text style={styles.heroTitle}>Resolva no campo.</Text>
                  <Text style={styles.heroSubtitle}>Registre cada ocorrência com clareza, velocidade e rastreabilidade.</Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <View style={styles.formHeader}>
                  <View>
                    <Text style={styles.formEyebrow}>ACESSO DO TÉCNICO</Text>
                    <Text style={styles.formTitle}>Vamos começar</Text>
                  </View>
                  <View style={styles.formBadge}><MaterialIcons name="verified-user" size={18} color={colors.primary} /></View>
                </View>
                <Text style={styles.formHint}>Acesse o ambiente DESKTOP com suas credenciais corporativas.</Text>
                <Text style={styles.inputLabel}>Usuário CSSO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite seu usuário CSSO"
                  placeholderTextColor={colors.muted}
                  value={username}
                  onChangeText={setUsername}
                  returnKeyType="next"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite sua senha"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleIdentification}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={handleIdentification}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.primaryButtonText}>Entrar no fluxo</Text>
                  <MaterialIcons name="arrow-forward" size={20} color={colors.background} />
                </Pressable>
                <View style={styles.localNotice}>
                  <MaterialIcons name="info-outline" size={16} color={colors.muted} />
                  <Text style={styles.localNoticeText}>Versão demonstrativa com dados locais</Text>
                </View>
              </View>
            </ScrollView>
          )}

          {step === "service" && (
            <FlatList
              data={filteredServices}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.serviceList}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View>
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.contextCard}>
                    <View style={styles.contextIcon}><MaterialIcons name="person-outline" size={22} color={colors.primary} /></View>
                    <View style={styles.contextCopy}>
                      <Text style={styles.contextLabel}>TÉCNICO IDENTIFICADO</Text>
                      <Text style={styles.contextValue}>{username.toUpperCase()}</Text>
                    </View>
                    <View style={styles.statusDot} />
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(80).duration(320)}>
                    <Text style={styles.formEyebrow}>ORDEM DE SERVIÇO</Text>
                    <Text style={styles.screenHeading}>Escolha uma SA</Text>
                    <Text style={styles.screenSubheading}>Estas são as ordens disponíveis para o seu atendimento.</Text>
                    <View style={styles.searchBox}>
                      <MaterialIcons name="search" size={20} color={colors.muted} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por SA, endereço ou serviço"
                        placeholderTextColor={colors.muted}
                        value={serviceSearch}
                        onChangeText={setServiceSearch}
                        returnKeyType="search"
                      />
                    </View>
                    <View style={styles.serviceCountRow}>
                      <Text style={styles.serviceCount}>{filteredServices.length} atendimentos encontrados</Text>
                      <MaterialIcons name="touch-app" size={17} color={colors.primary} />
                    </View>
                  </Animated.View>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="search-off" size={34} color={colors.muted} />
                  <Text style={styles.emptyTitle}>Nenhuma SA encontrada</Text>
                  <Text style={styles.emptyText}>Tente buscar por outro número ou endereço.</Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const isCompleted = completedServiceIds.includes(item.id);
                return (
                  <Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 55).duration(300)}>
                    <Pressable disabled={isCompleted} onPress={() => handleServiceSelection(item)} style={({ pressed }) => [styles.serviceCard, isCompleted && styles.serviceCardCompleted, pressed && !isCompleted && styles.cardPressed]}>
                      <View style={styles.serviceCardTop}>
                        <View style={[styles.serviceIcon, isCompleted && styles.serviceIconCompleted]}><MaterialIcons name={isCompleted ? "check" : "assignment"} size={20} color={isCompleted ? colors.success : colors.primary} /></View>
                        <View style={styles.serviceCardTitleWrap}><Text style={styles.serviceCardId}>{item.id}</Text><Text style={styles.serviceSchedule}>{item.schedule}</Text></View>
                        {isCompleted ? <View style={styles.completedBadge}><MaterialIcons name="verified" size={13} color={colors.success} /><Text style={styles.completedBadgeText}>Concluída</Text></View> : <MaterialIcons name="arrow-forward-ios" size={16} color={colors.primary} />}
                      </View>
                      <Text style={styles.serviceType}>{item.serviceType}</Text>
                      <View style={styles.serviceAddressRow}><MaterialIcons name="location-on" size={16} color={colors.muted} /><Text style={styles.serviceAddress}>{item.address}</Text></View>
                    </Pressable>
                  </Animated.View>
                );
              }}
            />
          )}

          {step === "reason" && (
            <FlatList
              data={reasons}
              keyExtractor={(item) => item.name}
              contentContainerStyle={styles.reasonList}
              ListHeaderComponent={
                <Animated.View entering={FadeInDown.duration(300)} style={styles.listHeader}>
                  <View style={styles.saChip}><MaterialIcons name="assignment" size={15} color={colors.primary} /><Text style={styles.saChipText}>{selectedService?.id}</Text></View>
                  <Text style={styles.screenHeading}>O que aconteceu no atendimento?</Text>
                  <Text style={styles.screenSubheading}>Escolha um motivo para seguir com a orientação correta.</Text>
                </Animated.View>
              }
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 45).duration(300)}>
                  <Pressable
                    onPress={() => handleReasonSelection(item)}
                    style={({ pressed }) => [
                      styles.reasonCard,
                      !item.available && styles.reasonCardDisabled,
                      pressed && item.available && styles.cardPressed,
                    ]}
                  >
                    <View style={[styles.reasonIcon, item.available ? styles.reasonIconActive : styles.reasonIconLocked]}>
                      <MaterialIcons name={item.available ? "location-searching" : "lock-outline"} size={19} color={item.available ? colors.primary : colors.muted} />
                    </View>
                    <View style={styles.reasonCopy}>
                      <Text style={[styles.reasonTitle, !item.available && styles.reasonTitleDisabled]}>{item.name}</Text>
                      <Text style={styles.reasonDetail}>{item.detail}</Text>
                    </View>
                    <MaterialIcons name={item.available ? "arrow-forward-ios" : "lock"} size={16} color={item.available ? colors.primary : colors.muted} />
                  </Pressable>
                </Animated.View>
              )}
            />
          )}

          {step === "evidence" && (
            <ScrollView contentContainerStyle={styles.evidenceContent}>
              <Animated.View entering={FadeInDown.duration(300)} style={styles.selectedReasonCard}>
                <View style={styles.selectedReasonIcon}><MaterialIcons name="location-searching" size={21} color={colors.background} /></View>
                <View style={styles.selectedReasonCopy}>
                  <Text style={styles.contextLabel}>MOTIVO SELECIONADO</Text>
                  <Text style={styles.selectedReasonText}>{selectedReason}</Text>
                </View>
              </Animated.View>
              {(() => {
                const config = getEvidenceGuide(selectedReason);
                return (
                  <View>
                    <Text style={styles.screenHeading}>{config.title}</Text>
                    <Text style={styles.screenSubheading}>{config.subtitle}</Text>
                    <View style={styles.evidenceList}>
                      {config.points.map((point, index) => (
                        <Animated.View key={point} entering={FadeInDown.delay(index * 70).duration(300)} style={styles.evidenceRow}>
                          <View style={styles.checkDot}><MaterialIcons name="check" size={14} color={colors.background} /></View>
                          <Text style={styles.evidenceText}>{point}</Text>
                        </Animated.View>
                      ))}
                    </View>
                  </View>
                );
              })()}
              <View style={styles.evidenceActionArea}>
                {!evidenceAdded ? (
                  <Pressable onPress={handleOpenCamera} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                    <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
                    <Text style={styles.secondaryButtonText}>Abrir câmera guiada</Text>
                  </Pressable>
                ) : (
                  <Animated.View entering={FadeInDown.duration(240)} style={styles.evidenceAddedCard}>
                    {photoUri && photoUri !== "demo-photo" ? <Image source={{ uri: photoUri }} style={styles.photoThumb} /> : <View style={styles.evidenceAddedIcon}><MaterialIcons name="check" size={19} color={colors.background} /></View>}
                    <View style={styles.evidenceAddedCopy}>
                      <Text style={styles.evidenceAddedTitle}>Evidência capturada</Text>
                      <Text style={styles.evidenceAddedText}>Pronta para a etapa de validação.</Text>
                    </View>
                    <Pressable onPress={handleRetakePhoto} style={({ pressed }) => [styles.retakeButton, pressed && styles.iconPressed]}><MaterialIcons name="refresh" size={18} color={colors.primary} /></Pressable>
                  </Animated.View>
                )}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!evidenceAdded || isSubmitting}
                  style={({ pressed }) => [styles.primaryButton, (!evidenceAdded || isSubmitting) && styles.disabledButton, pressed && evidenceAdded && !isSubmitting && styles.buttonPressed]}
                >
                  {isSubmitting ? <ActivityIndicator color={colors.background} /> : <><Text style={styles.primaryButtonText}>Enviar e concluir SA</Text><MaterialIcons name="check-circle-outline" size={20} color={colors.background} /></>}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {step === "complete" && (
            <ScrollView contentContainerStyle={styles.completeContent}>
              <Animated.View entering={FadeInDown.duration(420)} style={styles.completeIcon}><MaterialIcons name="check" size={48} color={colors.background} /></Animated.View>
              <Text style={styles.completeKicker}>DESKTOP • REGISTRO CONCLUÍDO</Text>
              <Text style={styles.completeTitle}>SA concluída e auditada.</Text>
              <Text style={styles.completeSubtitle}>A quebra da SA {selectedService?.id} foi concluída e enviada para auditoria.</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}><MaterialIcons name="assignment-turned-in" size={20} color={colors.success} /><Text style={styles.summaryText}>SA marcada como concluída</Text></View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}><MaterialIcons name="cloud-done" size={20} color={colors.success} /><Text style={styles.summaryText}>Dados e evidência salvos no backend</Text></View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}><MaterialIcons name="location-on" size={20} color={colors.success} /><Text style={styles.summaryText}>{gpsSnapshot ? `GPS registrado: ${gpsSnapshot.latitude.toFixed(5)}, ${gpsSnapshot.longitude.toFixed(5)}` : "Registro de localização processado"}</Text></View>
                {auditId ? <><View style={styles.summaryDivider} /><View style={styles.summaryRow}><MaterialIcons name="fingerprint" size={20} color={colors.primary} /><Text style={styles.summaryText}>Protocolo de auditoria: {auditId}</Text></View></> : null}
              </View>
              <Pressable onPress={handleReset} style={({ pressed }) => [styles.primaryButton, styles.fullButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>Registrar nova quebra</Text>
                <MaterialIcons name="add" size={20} color={colors.background} />
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>
        {isSubmitting && (
          <View style={styles.submissionOverlay} pointerEvents="auto">
            <Animated.View entering={FadeInDown.duration(240)} style={styles.submissionPanel}>
              <Animated.View style={[styles.submissionSpinner, submitSpinStyle]}>
                <View style={styles.submissionSpinnerCore}>
                  <MaterialIcons name="cloud-upload" size={30} color={colors.background} />
                </View>
              </Animated.View>
              <Text style={styles.submissionKicker}>DESKTOP • AUDITORIA</Text>
              <Text style={styles.submissionTitle}>Enviando dados...</Text>
              <Text style={styles.submissionText}>Só um minuto. Estamos salvando a evidência, o GPS e o registro da SA.</Text>
              <View style={styles.submissionProgressRow}>
                <View style={styles.submissionProgressDot}><MaterialIcons name="check" size={13} color={colors.background} /></View>
                <Text style={styles.submissionProgressText}>Evidência preparada</Text>
              </View>
              <View style={styles.submissionProgressRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.submissionProgressText}>Registrando no backend</Text>
              </View>
              <Text style={styles.submissionFooter}>Não feche esta tela durante o envio.</Text>
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  keyboard: { flex: 1 },
  content: { flex: 1 },
  topBar: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  topBrandRow: { flexDirection: "row", alignItems: "center", minHeight: 26 },
  topTitleRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  miniBrand: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 2.3 },
  stepCounter: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  topBarSpacer: { flex: 1 },
  topTitle: { color: colors.foreground, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  progressTrack: { flex: 1, height: 5, borderRadius: 99, backgroundColor: colors.border, marginLeft: 16, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 99 },
  backPressable: { padding: 6, marginRight: 11, marginLeft: -6 },
  disabledBackPressable: { opacity: 0.3 },
  iconPressed: { opacity: 0.55 },
  identificationContent: { flexGrow: 1, paddingBottom: 26 },
  heroBackdrop: { minHeight: 300, backgroundColor: colors.accent, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 30, overflow: "hidden" },
  heroCircleLarge: { position: "absolute", width: 270, height: 270, borderRadius: 135, right: -100, top: -90, backgroundColor: colors.primary, opacity: 0.42 },
  heroCircleSmall: { position: "absolute", width: 120, height: 120, borderRadius: 60, left: -45, bottom: -50, backgroundColor: colors.warning, opacity: 0.84 },
  brandLockup: { flexDirection: "row", alignItems: "center" },
  brandIconBox: { width: 44, height: 44, borderRadius: 13, borderWidth: 1.5, borderColor: colors.warning, alignItems: "center", justifyContent: "center", position: "relative", backgroundColor: colors.accent },
  brandIconText: { color: colors.warning, fontSize: 31, fontWeight: "300", lineHeight: 34 },
  brandIconSlash: { width: 2, height: 36, backgroundColor: colors.warning, transform: [{ rotate: "24deg" }], position: "absolute", right: 11 },
  brandName: { color: colors.background, fontSize: 20, fontWeight: "900", letterSpacing: 4, marginLeft: 12 },
  brandDescriptor: { color: colors.warning, fontSize: 8, fontWeight: "800", letterSpacing: 1.25, position: "absolute", left: 56, bottom: -13 },
  heroCopy: { marginTop: 63, maxWidth: 330 },
  heroKicker: { color: colors.warning, fontSize: 11, fontWeight: "900", letterSpacing: 1.8, marginBottom: 9 },
  heroTitle: { color: colors.background, fontSize: 36, lineHeight: 41, fontWeight: "900", letterSpacing: -1.4 },
  heroSubtitle: { color: "#e6e6e6", fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 290 },
  formCard: { marginHorizontal: 18, marginTop: -22, padding: 22, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: colors.accent, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  formCardCompact: { padding: 22, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: colors.accent, shadowOpacity: 0.11, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  formHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  formEyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 7 },
  formTitle: { color: colors.foreground, fontSize: 24, lineHeight: 29, fontWeight: "800" },
  formBadge: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "16" },
  formHint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 13, marginBottom: 24 },
  inputLabel: { color: colors.foreground, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  input: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, fontSize: 16, paddingHorizontal: 16, marginBottom: 14 },
  primaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryButtonText: { color: colors.background, fontSize: 15, fontWeight: "900", letterSpacing: 0.1 },
  secondaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.background, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  buttonPressed: { transform: [{ scale: 0.975 }], opacity: 0.88 },
  disabledButton: { opacity: 0.42 },
  localNotice: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 18, gap: 6 },
  localNoticeText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  formScreenContent: { flexGrow: 1, padding: 20, gap: 18 },
  serviceList: { padding: 20, paddingBottom: 32, gap: 12 },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 11 },
  searchInput: { flex: 1, color: colors.foreground, fontSize: 14, paddingVertical: 0 },
  serviceCountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  serviceCount: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  serviceCard: { padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  serviceCardCompleted: { borderColor: colors.success + "66", backgroundColor: colors.success + "0b" },
  serviceCardTop: { flexDirection: "row", alignItems: "center" },
  serviceIcon: { width: 41, height: 41, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "16" },
  serviceIconCompleted: { backgroundColor: colors.success + "18" },
  completedBadge: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, borderRadius: 99, backgroundColor: colors.success + "18" },
  completedBadgeText: { color: colors.success, fontSize: 10, fontWeight: "900" },
  serviceCardTitleWrap: { flex: 1, marginLeft: 11 },
  serviceCardId: { color: colors.foreground, fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  serviceSchedule: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 4 },
  serviceType: { color: colors.foreground, fontSize: 13, fontWeight: "800", marginTop: 14 },
  serviceAddressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  serviceAddress: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 50, paddingHorizontal: 24 },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900", marginTop: 13 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 7 },
  contextCard: { flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 17, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent },
  contextIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center" },
  contextCopy: { flex: 1, marginLeft: 12 },
  contextLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 4 },
  contextValue: { color: colors.background, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning },
  screenHeading: { color: colors.foreground, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  screenSubheading: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 24 },
  reasonList: { padding: 20, paddingBottom: 32, gap: 10 },
  listHeader: { marginBottom: 8 },
  saChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 99, backgroundColor: colors.primary + "16", marginBottom: 17 },
  saChipText: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  reasonCard: { minHeight: 76, flexDirection: "row", alignItems: "center", padding: 13, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reasonCardDisabled: { opacity: 0.57 },
  reasonIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  reasonIconActive: { backgroundColor: colors.primary + "16" },
  reasonIconLocked: { backgroundColor: colors.border },
  reasonCopy: { flex: 1, marginHorizontal: 12 },
  reasonTitle: { color: colors.foreground, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  reasonTitleDisabled: { color: colors.muted },
  reasonDetail: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  evidenceContent: { flexGrow: 1, padding: 20, paddingBottom: 30 },
  selectedReasonCard: { flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 18, backgroundColor: colors.accent, marginBottom: 28 },
  selectedReasonIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  selectedReasonCopy: { flex: 1, marginLeft: 12 },
  selectedReasonText: { color: colors.background, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  evidenceList: { gap: 13, marginTop: 4 },
  evidenceRow: { flexDirection: "row", alignItems: "flex-start" },
  checkDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginRight: 10, marginTop: 1 },
  evidenceText: { flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  evidenceActionArea: { flex: 1, justifyContent: "flex-end", gap: 12, marginTop: 30 },
  evidenceAddedCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, backgroundColor: colors.success + "12", borderWidth: 1, borderColor: colors.success + "45" },
  evidenceAddedIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
  evidenceAddedCopy: { flex: 1, marginLeft: 10 },
  evidenceAddedTitle: { color: colors.success, fontSize: 13, fontWeight: "900" },
  evidenceAddedText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  retakeButton: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "16" },
  submissionOverlay: { position: "absolute", zIndex: 100, top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "#00000099" },
  submissionPanel: { width: "100%", maxWidth: 360, alignItems: "center", padding: 28, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  submissionSpinner: { width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 41, borderWidth: 4, borderColor: colors.warning, borderTopColor: colors.primary, marginBottom: 20 },
  submissionSpinnerCore: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: colors.primary },
  submissionKicker: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.7 },
  submissionTitle: { color: colors.foreground, fontSize: 27, lineHeight: 33, fontWeight: "900", marginTop: 8, textAlign: "center" },
  submissionText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: "center" },
  submissionProgressRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  submissionProgressDot: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: colors.success },
  submissionProgressText: { flex: 1, color: colors.foreground, fontSize: 13, fontWeight: "700" },
  submissionFooter: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 24 },
  completeContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  completeIcon: { width: 92, height: 92, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginBottom: 22, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  completeKicker: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" },
  completeTitle: { color: colors.foreground, fontSize: 30, lineHeight: 35, fontWeight: "900", letterSpacing: -0.8, textAlign: "center", marginTop: 9 },
  completeSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10, marginBottom: 27, maxWidth: 330 },
  summaryCard: { width: "100%", borderRadius: 18, padding: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  summaryText: { flex: 1, color: colors.foreground, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  fullButton: { width: "100%" },
  photoThumb: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.border },
  cameraOverlay: { position: "absolute", zIndex: 30, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#080808" },
  cameraView: { flex: 1 },
  cameraGuideLayer: { position: "absolute", top: 0, right: 0, bottom: 108, left: 0, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, backgroundColor: "#00000028" },
  cameraTopCopy: { position: "absolute", top: 82, left: 24, right: 24 },
  cameraVoicePanel: { position: "absolute", top: 28, right: 20, zIndex: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  cameraVoiceStatus: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, borderRadius: 99, backgroundColor: "#00000088" },
  voiceStatusDot: { width: 8, height: 8, borderRadius: 4 },
  cameraVoiceLabel: { color: colors.background, fontSize: 10, fontWeight: "800" },
  cameraVoiceButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  cameraKicker: { color: colors.warning, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  cameraTitle: { color: colors.background, fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 8 },
  cameraSubtitle: { color: "#eeeeee", fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 350 },
  cameraReadyPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, backgroundColor: "#00000066" },
  cameraReadyDot: { width: 8, height: 8, borderRadius: 4 },
  cameraReadyText: { color: colors.background, fontSize: 11, fontWeight: "800" },
  documentFrame: { width: "100%", height: 292, borderRadius: 16, position: "relative", borderWidth: 1, borderColor: "#ffffff88", backgroundColor: "#ffffff08" },
  frameCorner: { position: "absolute", width: 34, height: 34, borderColor: colors.warning },
  frameTopLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  frameTopRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  frameBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  frameBottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  frameHint: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", marginTop: 108, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "#00000066" },
  frameHintText: { color: colors.background, fontSize: 12, fontWeight: "800" },
  cameraBottomCopy: { position: "absolute", bottom: 20, left: 24, right: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  cameraBottomText: { flex: 1, color: "#eeeeee", fontSize: 12, lineHeight: 17 },
  cameraControls: { height: 118, position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, backgroundColor: "#080808" },
  cameraCancelButton: { minWidth: 76, paddingVertical: 12 },
  cameraCancelText: { color: colors.background, fontSize: 14, fontWeight: "800" },
  cameraHelpButton: { minWidth: 76, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, paddingVertical: 12 },
  cameraHelpText: { color: colors.background, fontSize: 13, fontWeight: "800" },
  shutterButton: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.background, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.warning },
  shutterPressed: { transform: [{ scale: 0.9 }], opacity: 0.85 },
});
