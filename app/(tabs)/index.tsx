import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
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

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type Step = "identification" | "service" | "reason" | "evidence" | "complete";
type Reason = { name: string; available: boolean; detail: string };

type ServiceAppointment = {
  id: string;
  address: string;
};

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
  { name: "COP - Equipamento não retirado - Sem contato com cliente", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Erros de cadastro (Telefone, Endereço, etc)", available: false, detail: "Regras ainda não cadastradas" },
  { name: "COP - Sem estrutura/SEM PTR no local", available: false, detail: "Regras ainda não cadastradas" },
  { name: "Retorno ao COP", available: false, detail: "Regras ainda não cadastradas" },
];

const evidencePoints = [
  "Foto enviada como evidência do atendimento",
  "Timestamp presente na evidência, quando disponível",
  "Localização/endereço apresentado na evidência",
  "Comparação com o endereço cadastrado no Salesforce",
];

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

  const goBack = () => {
    if (step === "service") setStep("identification");
    if (step === "reason") setStep("service");
    if (step === "evidence") setStep("reason");
    if (step === "complete") setStep("evidence");
  };

  const tapFeedback = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleIdentification = () => {
    if (!technicianId.trim()) {
      Alert.alert("Identificação necessária", "Por favor, informe sua matrícula ou ID.");
      return;
    }
    tapFeedback();
    setStep("service");
  };

  const handleServiceSelection = () => {
    if (!serviceId.trim()) {
      Alert.alert("SA necessária", "Por favor, informe o número da SA.");
      return;
    }
    tapFeedback();
    setSelectedService({
      id: serviceId,
      address: "Endereço ainda não consultado",
    });
    setStep("reason");
  };

  const handleReasonSelection = (reason: Reason) => {
    if (!reason.available) {
      Alert.alert("Motivo indisponível", "As regras para este motivo ainda não foram mapeadas no sistema.");
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
      Alert.alert("Evidência necessária", "Por favor, adicione a evidência solicitada.");
      return;
    }
    tapFeedback();
    setIsSubmitting(true);
    
    // Simulate validation and submission
    setTimeout(() => {
      setIsSubmitting(false);
      setStep("complete");
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 2000);
  };

  const handleReset = () => {
    tapFeedback();
    setServiceId("");
    setSelectedService(null);
    setSelectedReason("");
    setEvidenceAdded(false);
    setStep("service");
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="px-6 py-4 border-b border-border flex-row items-center">
          {step !== "identification" && step !== "complete" && (
            <Pressable 
              onPress={goBack}
              style={({ pressed }) => [styles.backPressable, pressed && styles.buttonPressed]}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
            </Pressable>
          )}
          <Text className="text-xl font-bold text-foreground">
            {step === "identification" ? "Identificação" : 
             step === "service" ? "Selecionar SA" : 
             step === "reason" ? "Motivo da Quebra" : 
             step === "evidence" ? "Coleta de Evidências" : "Concluído"}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          {step === "identification" && (
            <View className="p-6 flex-1 justify-center">
              <View className="items-center mb-8">
                <MaterialIcons name="engineering" size={64} color={colors.primary} />
                <Text className="text-2xl font-bold text-foreground mt-4 text-center">
                  App de Quebras
                </Text>
                <Text className="text-base text-muted text-center mt-2">
                  Identifique-se para iniciar o atendimento
                </Text>
              </View>
              
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">Matrícula / ID do Técnico</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                    placeholder="Ex: T12345"
                    placeholderTextColor={colors.muted}
                    value={technicianId}
                    onChangeText={setTechnicianId}
                    returnKeyType="done"
                    onSubmitEditing={handleIdentification}
                  />
                </View>
                
                <Pressable
                  onPress={handleIdentification}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed
                  ]}
                >
                  <Text className="text-background font-semibold text-base text-center">Entrar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "service" && (
            <View className="p-6 flex-1">
              <Text className="text-base text-muted mb-6">
                Olá, {technicianId}. Informe a SA que deseja registrar a quebra.
              </Text>
              
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-medium text-foreground mb-2">Número da SA</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
                    placeholder="Ex: SA-987654"
                    placeholderTextColor={colors.muted}
                    value={serviceId}
                    onChangeText={setServiceId}
                    returnKeyType="done"
                    onSubmitEditing={handleServiceSelection}
                  />
                </View>
                
                <Pressable
                  onPress={handleServiceSelection}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed
                  ]}
                >
                  <Text className="text-background font-semibold text-base text-center">Continuar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "reason" && (
            <FlatList
              data={reasons}
              keyExtractor={(item) => item.name}
              contentContainerStyle={{ padding: 24, gap: 12 }}
              ListHeaderComponent={
                <View className="mb-4">
                  <Text className="text-lg font-semibold text-foreground">SA: {selectedService?.id}</Text>
                  <Text className="text-sm text-muted mt-1">{selectedService?.address}</Text>
                  <Text className="text-base font-medium text-foreground mt-6 mb-2">Selecione o motivo da quebra:</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleReasonSelection(item)}
                  style={({ pressed }) => [
                    styles.reasonCard,
                    !item.available && styles.reasonCardDisabled,
                    pressed && item.available && styles.cardPressed
                  ]}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className={`text-base font-medium ${item.available ? 'text-foreground' : 'text-muted'}`}>
                        {item.name}
                      </Text>
                      <Text className="text-xs text-muted mt-1">{item.detail}</Text>
                    </View>
                    <MaterialIcons 
                      name={item.available ? "chevron-right" : "lock"} 
                      size={24} 
                      color={item.available ? colors.primary : colors.muted} 
                    />
                  </View>
                </Pressable>
              )}
            />
          )}

          {step === "evidence" && (
            <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
              <View className="bg-surface border border-border rounded-2xl p-4 mb-6">
                <Text className="text-sm text-muted mb-1">Motivo selecionado:</Text>
                <Text className="text-base font-semibold text-foreground">{selectedReason}</Text>
              </View>

              <Text className="text-lg font-semibold text-foreground mb-4">Evidências Necessárias</Text>
              <Text className="text-base text-muted mb-6">
                Para este motivo, o fluxo organiza as evidências e registra as validações que precisarão ser automatizadas:
              </Text>

              <View className="gap-3 mb-8">
                {evidencePoints.map((point, index) => (
                  <View key={index} className="flex-row items-start">
                    <MaterialIcons name="check-circle" size={20} color={colors.primary} style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-base text-foreground flex-1">{point}</Text>
                  </View>
                ))}
              </View>

              <View className="flex-1 justify-end gap-4">
                {!evidenceAdded ? (
                  <Pressable
                    onPress={handleAddEvidence}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed
                    ]}
                  >
                    <MaterialIcons name="camera-alt" size={24} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text className="text-primary font-semibold text-base text-center">Adicionar evidência</Text>
                  </Pressable>
                ) : (
                  <View className="bg-success/10 border border-success/30 rounded-xl p-4 flex-row items-center mb-4">
                    <MaterialIcons name="check-circle" size={24} color={colors.success} style={{ marginRight: 12 }} />
                    <View className="flex-1">
                      <Text className="text-success font-semibold">Evidência capturada</Text>
                      <Text className="text-success/80 text-sm mt-1">Evidência pronta para a etapa de validação.</Text>
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={!evidenceAdded || isSubmitting}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!evidenceAdded || isSubmitting) && { opacity: 0.5 },
                    pressed && evidenceAdded && !isSubmitting && styles.buttonPressed
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text className="text-background font-semibold text-base text-center">Registrar solicitação</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {step === "complete" && (
            <View className="p-6 flex-1 justify-center items-center">
              <View className="w-24 h-24 bg-success/20 rounded-full items-center justify-center mb-6">
                <MaterialIcons name="check" size={48} color={colors.success} />
              </View>
              
              <Text className="text-2xl font-bold text-foreground text-center mb-2">
                Solicitação registrada
              </Text>
              
              <Text className="text-base text-muted text-center mb-8">
                A solicitação da SA {selectedService?.id} foi registrada em modo demonstrativo com o motivo "{selectedReason}".
              </Text>
              
              <View className="w-full bg-surface border border-border rounded-2xl p-4 mb-8">
                <Text className="text-sm font-medium text-foreground mb-2">Resumo do registro demonstrativo:</Text>
                <View className="flex-row items-center mt-2">
                  <MaterialIcons name="location-on" size={16} color={colors.success} style={{ marginRight: 8 }} />
                  <Text className="text-sm text-muted flex-1">Evidência vinculada à solicitação</Text>
                </View>
                <View className="flex-row items-center mt-2">
                  <MaterialIcons name="schedule" size={16} color={colors.success} style={{ marginRight: 8 }} />
                  <Text className="text-sm text-muted flex-1">Regras de validação aguardando parametrização</Text>
                </View>
              </View>

              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { width: '100%' },
                  pressed && styles.buttonPressed
                ]}
              >
                <Text className="text-background font-semibold text-base text-center">Nova Quebra</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  backPressable: {
    marginRight: 16,
    marginLeft: -8,
    padding: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  reasonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  reasonCardDisabled: {
    opacity: 0.6,
    backgroundColor: 'transparent',
  },
  cardPressed: {
    opacity: 0.7,
  },
});
