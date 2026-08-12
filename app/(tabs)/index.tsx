import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type Step = "identification" | "service" | "reason" | "evidence" | "complete";
type Reason = { name: string; available: boolean; detail: string };
type ServiceAppointment = { id: string; address: string };

const reasons: Reason[] = [
  { name: "COP - Área não atendida", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Área Saturada", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Cliente Ausente", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Cliente cancelou a manutenção", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Cliente mudou de endereço", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Condomínio não atendido", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Condomínio Saturado", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Conduíte obstruído", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Alteração de Plano", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Migração", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Desistência da Mudança de Endereço", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Endereço não localizado", available: true, detail: "Fluxo disponível no MVP" },
  { name: "COP - Equipamento não retirado", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Erros de cadastro", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Sem estrutura / sem PTR no local", available: false, detail: "Regras ainda não cadastradas" },
  { name: "Retorno ao COP", available: false, detail: "Regras ainda não cadastradas" },
];

const evidencePoints = [
  "Foto enviada como evidência do atendimento",
  "Timestamp presente na evidência, quando disponível",
  "Localização apresentada na evidência",
  "Comparação com o endereço cadastrado no Salesforce",
];

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
  const [technicianId, setTechnicianId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceAppointment | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [evidenceAdded, setEvidenceAdded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const screenProgress = useSharedValue(1);
  const brandPulse = useSharedValue(0);
  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenProgress.value,
    transform: [{ translateY: (1 - screenProgress.value) * 16 }],
  }));
  const brandAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + brandPulse.value * 0.035 }],
  }));

  useEffect(() => {
    screenProgress.value = 0;
    screenProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [screenProgress, step]);

  useEffect(() => {
    brandPulse.value = withSequence(
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
    );
  }, [brandPulse]);

  const tapFeedback = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goBack = () => {
    tapFeedback();
    if (step === "service") setStep("identification");
    if (step === "reason") setStep("service");
    if (step === "evidence") setStep("reason");
    if (step === "complete") setStep("evidence");
  };

  const handleIdentification = () => {
    if (!technicianId.trim()) {
      Alert.alert("Identificação necessária", "Informe sua matrícula ou ID para continuar.");
      return;
    }
    tapFeedback();
    setStep("service");
  };

  const handleServiceSelection = () => {
    if (!serviceId.trim()) {
      Alert.alert("SA necessária", "Informe o número da SA para continuar.");
      return;
    }
    tapFeedback();
    setSelectedService({ id: serviceId.trim().toUpperCase(), address: "Endereço ainda não consultado" });
    setStep("reason");
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

  const handleAddEvidence = () => {
    tapFeedback();
    setEvidenceAdded(true);
  };

  const handleSubmit = () => {
    if (!evidenceAdded) {
      Alert.alert("Evidência necessária", "Adicione a evidência solicitada antes de registrar.");
      return;
    }
    tapFeedback();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep("complete");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1100);
  };

  const handleReset = () => {
    tapFeedback();
    setServiceId("");
    setSelectedService(null);
    setSelectedReason("");
    setEvidenceAdded(false);
    setStep("service");
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBrandRow}>
        {step !== "identification" && step !== "complete" ? (
          <Pressable
            accessibilityLabel="Voltar"
            onPress={goBack}
            style={({ pressed }) => [styles.backPressable, pressed && styles.iconPressed]}
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
                <Text style={styles.formHint}>Use sua matrícula para iniciar um novo registro de quebra.</Text>
                <Text style={styles.inputLabel}>Matrícula / ID do técnico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex.: T12345"
                  placeholderTextColor={colors.muted}
                  value={technicianId}
                  onChangeText={setTechnicianId}
                  returnKeyType="done"
                  onSubmitEditing={handleIdentification}
                  autoCapitalize="characters"
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
            <ScrollView contentContainerStyle={styles.formScreenContent} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(300)} style={styles.contextCard}>
                <View style={styles.contextIcon}><MaterialIcons name="person-outline" size={22} color={colors.primary} /></View>
                <View style={styles.contextCopy}>
                  <Text style={styles.contextLabel}>TÉCNICO IDENTIFICADO</Text>
                  <Text style={styles.contextValue}>{technicianId.toUpperCase()}</Text>
                </View>
                <View style={styles.statusDot} />
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(80).duration(320)} style={styles.formCardCompact}>
                <Text style={styles.formEyebrow}>ORDEM DE SERVIÇO</Text>
                <Text style={styles.screenHeading}>Qual SA será registrada?</Text>
                <Text style={styles.screenSubheading}>Informe o número da solicitação técnica para carregar o próximo passo.</Text>
                <Text style={styles.inputLabel}>Número da SA</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex.: SA-987654"
                  placeholderTextColor={colors.muted}
                  value={serviceId}
                  onChangeText={setServiceId}
                  returnKeyType="done"
                  onSubmitEditing={handleServiceSelection}
                  autoCapitalize="characters"
                />
                <Pressable onPress={handleServiceSelection} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                  <MaterialIcons name="arrow-forward" size={20} color={colors.background} />
                </Pressable>
              </Animated.View>
            </ScrollView>
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
              <Text style={styles.screenHeading}>Monte a evidência</Text>
              <Text style={styles.screenSubheading}>Confira os pontos que serão organizados para a validação do registro.</Text>
              <View style={styles.evidenceList}>
                {evidencePoints.map((point, index) => (
                  <Animated.View key={point} entering={FadeInDown.delay(index * 70).duration(300)} style={styles.evidenceRow}>
                    <View style={styles.checkDot}><MaterialIcons name="check" size={14} color={colors.background} /></View>
                    <Text style={styles.evidenceText}>{point}</Text>
                  </Animated.View>
                ))}
              </View>
              <View style={styles.evidenceActionArea}>
                {!evidenceAdded ? (
                  <Pressable onPress={handleAddEvidence} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                    <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
                    <Text style={styles.secondaryButtonText}>Adicionar evidência</Text>
                  </Pressable>
                ) : (
                  <Animated.View entering={FadeInDown.duration(240)} style={styles.evidenceAddedCard}>
                    <View style={styles.evidenceAddedIcon}><MaterialIcons name="check" size={19} color={colors.background} /></View>
                    <View style={styles.evidenceAddedCopy}>
                      <Text style={styles.evidenceAddedTitle}>Evidência capturada</Text>
                      <Text style={styles.evidenceAddedText}>Pronta para a etapa de validação.</Text>
                    </View>
                    <MaterialIcons name="done-all" size={20} color={colors.success} />
                  </Animated.View>
                )}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!evidenceAdded || isSubmitting}
                  style={({ pressed }) => [styles.primaryButton, (!evidenceAdded || isSubmitting) && styles.disabledButton, pressed && evidenceAdded && !isSubmitting && styles.buttonPressed]}
                >
                  {isSubmitting ? <ActivityIndicator color={colors.background} /> : <><Text style={styles.primaryButtonText}>Registrar solicitação</Text><MaterialIcons name="check-circle-outline" size={20} color={colors.background} /></>}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {step === "complete" && (
            <ScrollView contentContainerStyle={styles.completeContent}>
              <Animated.View entering={FadeInDown.duration(420)} style={styles.completeIcon}><MaterialIcons name="check" size={48} color={colors.background} /></Animated.View>
              <Text style={styles.completeKicker}>DESKTOP • REGISTRO CONCLUÍDO</Text>
              <Text style={styles.completeTitle}>Solicitação registrada.</Text>
              <Text style={styles.completeSubtitle}>A quebra da SA {selectedService?.id} foi organizada em modo demonstrativo.</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}><MaterialIcons name="assignment-turned-in" size={20} color={colors.primary} /><Text style={styles.summaryText}>Evidência vinculada à solicitação</Text></View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}><MaterialIcons name="schedule" size={20} color={colors.primary} /><Text style={styles.summaryText}>Validações prontas para parametrização</Text></View>
              </View>
              <Pressable onPress={handleReset} style={({ pressed }) => [styles.primaryButton, styles.fullButton, pressed && styles.buttonPressed]}>
                <Text style={styles.primaryButtonText}>Registrar nova quebra</Text>
                <MaterialIcons name="add" size={20} color={colors.background} />
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>
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
});
