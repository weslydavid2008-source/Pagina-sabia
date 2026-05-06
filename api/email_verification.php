<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"];
$input = json_decode(file_get_contents("php://input"), true);

if ($method !== "POST") {
    responder([
        "ok" => false,
        "mensaje" => "Método no permitido."
    ], 405);
}

if (!is_array($input)) {
    responder([
        "ok" => false,
        "mensaje" => "JSON inválido."
    ], 400);
}

$accion = $input["accion"] ?? "";

if ($accion === "solicitar_otp_registro") {
    solicitarOtpRegistro($pdo, $input);
}

if ($accion === "verificar_otp_registro") {
    verificarOtpRegistro($pdo, $input);
}

responder([
    "ok" => false,
    "mensaje" => "Acción no permitida."
], 405);

/* =========================================================
   SOLICITAR OTP PARA REGISTRO
========================================================= */

function solicitarOtpRegistro($pdo, $input) {
    $correo = trim($input["correo"] ?? "");

    if ($correo === "") {
        responder([
            "ok" => false,
            "mensaje" => "Ingresa tu correo."
        ], 400);
    }

    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        responder([
            "ok" => false,
            "mensaje" => "Correo inválido."
        ], 400);
    }

    try {
        $stmtExiste = $pdo->prepare("
            SELECT id_usuario
            FROM Usuarios
            WHERE correo = :correo
            LIMIT 1
        ");

        $stmtExiste->execute([
            ":correo" => $correo
        ]);

        $usuarioExiste = $stmtExiste->fetch(PDO::FETCH_ASSOC);

        if ($usuarioExiste) {
            responder([
                "ok" => false,
                "mensaje" => "Este correo ya está registrado."
            ], 400);
        }

        $codigo = (string) random_int(100000, 999999);
        $fechaExpiracion = date("Y-m-d H:i:s", strtotime("+10 minutes"));

        $pdo->beginTransaction();

        // Invalida códigos anteriores del mismo correo.
        $stmtInvalidar = $pdo->prepare("
            UPDATE RegistroCorreoOtps
            SET usado = 1
            WHERE correo = :correo
              AND usado = 0
        ");

        $stmtInvalidar->execute([
            ":correo" => $correo
        ]);

        // Guarda el nuevo código en texto normal, como pediste.
        $stmtInsert = $pdo->prepare("
            INSERT INTO RegistroCorreoOtps (
                correo,
                codigo,
                fecha_expiracion,
                usado,
                intentos
            ) VALUES (
                :correo,
                :codigo,
                :fecha_expiracion,
                0,
                0
            )
        ");

        $stmtInsert->execute([
            ":correo" => $correo,
            ":codigo" => $codigo,
            ":fecha_expiracion" => $fechaExpiracion
        ]);

        $pdo->commit();

        $resultadoCorreo = enviarCorreoOtpRegistro($correo, $codigo);

        $respuesta = [
            "ok" => true,
            "mensaje" => $resultadoCorreo["enviado"]
                ? "Te enviamos un código a tu correo."
                : "Código generado, pero no se pudo enviar el correo.",
            "correo" => $correo,
            "expira_en_minutos" => 10
        ];

        if (!$resultadoCorreo["enviado"]) {
            $respuesta["codigo_prueba"] = $codigo;
            $respuesta["error_correo"] = $resultadoCorreo["error"];
        }

        responder($respuesta);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error solicitando código: " . $error->getMessage()
        ], 500);
    }
}

/* =========================================================
   VERIFICAR OTP PARA REGISTRO
========================================================= */

function verificarOtpRegistro($pdo, $input) {
    $correo = trim($input["correo"] ?? "");
    $codigo = trim($input["codigo"] ?? "");

    if ($correo === "" || $codigo === "") {
        responder([
            "ok" => false,
            "mensaje" => "Correo y código son obligatorios."
        ], 400);
    }

    try {
        $otp = obtenerOtpRegistroValido($pdo, $correo, $codigo);

        if (!$otp) {
            responder([
                "ok" => false,
                "mensaje" => "Código incorrecto, vencido o ya usado."
            ], 400);
        }

        responder([
            "ok" => true,
            "mensaje" => "Correo verificado correctamente.",
            "correo" => $correo
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => "Error verificando código: " . $error->getMessage()
        ], 500);
    }
}

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function obtenerOtpRegistroValido($pdo, $correo, $codigo, $bloquear = false) {
    $sql = "
        SELECT
            id_otp,
            correo,
            codigo,
            fecha_expiracion,
            usado,
            intentos
        FROM RegistroCorreoOtps
        WHERE correo = :correo
          AND usado = 0
        ORDER BY id_otp DESC
        LIMIT 1
    ";

    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ":correo" => $correo
    ]);

    $otp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp) {
        return null;
    }

    if ((int) $otp["intentos"] >= 5) {
        return null;
    }

    if (strtotime($otp["fecha_expiracion"]) < time()) {
        return null;
    }

    if ((string) $otp["codigo"] !== (string) $codigo) {
        aumentarIntentosOtpRegistro($pdo, $otp["id_otp"]);
        return null;
    }

    return $otp;
}

function aumentarIntentosOtpRegistro($pdo, $idOtp) {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET intentos = intentos + 1
        WHERE id_otp = :id_otp
        LIMIT 1
    ");

    $stmt->execute([
        ":id_otp" => $idOtp
    ]);
}

function marcarOtpRegistroUsado($pdo, $correo, $codigo) {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET usado = 1
        WHERE correo = :correo
          AND codigo = :codigo
          AND usado = 0
        ORDER BY id_otp DESC
        LIMIT 1
    ");

    $stmt->execute([
        ":correo" => $correo,
        ":codigo" => $codigo
    ]);
}

function enviarCorreoOtpRegistro($correo, $codigo) {
    $autoloadPath = __DIR__ . "/../vendor/autoload.php";
    $configPath = __DIR__ . "/mail_config.php";

    if (!file_exists($autoloadPath)) {
        return [
            "enviado" => false,
            "error" => "No existe vendor/autoload.php. Instala PHPMailer con Composer."
        ];
    }

    if (!file_exists($configPath)) {
        return [
            "enviado" => false,
            "error" => "No existe api/mail_config.php."
        ];
    }

    require_once $autoloadPath;

    $config = require $configPath;

    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);

        $mail->isSMTP();
        $mail->Host = $config["host"];
        $mail->SMTPAuth = true;
        $mail->Username = $config["username"];
        $mail->Password = $config["password"];
        $mail->Port = (int) $config["port"];

        if (($config["smtp_secure"] ?? "") === "tls") {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        }

        if (($config["smtp_secure"] ?? "") === "ssl") {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        }

        $mail->CharSet = "UTF-8";
        $mail->setFrom($config["from_email"], $config["from_name"]);
        $mail->addAddress($correo, $correo);

        $mail->isHTML(true);
        $mail->Subject = "Verifica tu correo - Store Super Joven";

        $mail->Body = "
            <div style='font-family: Arial, sans-serif; color: #111827;'>
                <h2 style='color:#22c55e;'>Verificación de correo</h2>

                <p>Gracias por registrarte en <strong>Store Super Joven</strong>.</p>

                <p>Tu código para verificar el correo es:</p>

                <div style='
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 6px;
                    background: #f0fdf4;
                    color: #16a34a;
                    padding: 18px;
                    border-radius: 12px;
                    text-align: center;
                    margin: 22px 0;
                '>
                    {$codigo}
                </div>

                <p>Este código vence en <strong>10 minutos</strong>.</p>

                <p>Si no intentaste crear una cuenta, ignora este correo.</p>

                <hr style='border:none;border-top:1px solid #e5e7eb;margin:24px 0;'>

                <p style='color:#6b7280;font-size:13px;'>
                    Store Super Joven
                </p>
            </div>
        ";

        $mail->AltBody = "Tu código para verificar tu correo es: {$codigo}. Este código vence en 10 minutos.";

        $mail->send();

        return [
            "enviado" => true,
            "error" => null
        ];

    } catch (Throwable $error) {
        return [
            "enviado" => false,
            "error" => $error->getMessage()
        ];
    }
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}