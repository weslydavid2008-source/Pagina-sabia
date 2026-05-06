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

if ($accion === "solicitar_otp") {
    solicitarOtp($pdo, $input);
}

if ($accion === "verificar_otp") {
    verificarOtp($pdo, $input);
}

if ($accion === "cambiar_password") {
    cambiarPassword($pdo, $input);
}

responder([
    "ok" => false,
    "mensaje" => "Acción no permitida."
], 405);

function solicitarOtp($pdo, $input) {
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
        $stmt = $pdo->prepare("
            SELECT id_usuario, nombre, apellido, correo, estado
            FROM Usuarios
            WHERE correo = :correo
            LIMIT 1
        ");

        $stmt->execute([
            ":correo" => $correo
        ]);

        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$usuario) {
            responder([
                "ok" => false,
                "mensaje" => "No existe una cuenta con ese correo."
            ], 404);
        }

        if ($usuario["estado"] !== "activo") {
            responder([
                "ok" => false,
                "mensaje" => "Esta cuenta está inactiva."
            ], 403);
        }

        $codigo = (string) random_int(100000, 999999);
        $fechaExpiracion = date("Y-m-d H:i:s", strtotime("+10 minutes"));

        $pdo->beginTransaction();

        $stmtInvalidar = $pdo->prepare("
            UPDATE PasswordResetOtps
            SET usado = 1
            WHERE id_usuario = :id_usuario
              AND usado = 0
        ");

        $stmtInvalidar->execute([
            ":id_usuario" => $usuario["id_usuario"]
        ]);

        $stmtInsert = $pdo->prepare("
            INSERT INTO PasswordResetOtps (
                id_usuario,
                correo,
                codigo,
                fecha_expiracion,
                usado,
                intentos
            ) VALUES (
                :id_usuario,
                :correo,
                :codigo,
                :fecha_expiracion,
                0,
                0
            )
        ");

        $stmtInsert->execute([
            ":id_usuario" => $usuario["id_usuario"],
            ":correo" => $usuario["correo"],
            ":codigo" => $codigo,
            ":fecha_expiracion" => $fechaExpiracion
        ]);

        $pdo->commit();

        $nombreCompleto = trim(($usuario["nombre"] ?? "") . " " . ($usuario["apellido"] ?? ""));
        $resultadoCorreo = enviarCorreoOtp($usuario["correo"], $nombreCompleto, $codigo);

        $respuesta = [
            "ok" => true,
            "mensaje" => $resultadoCorreo["enviado"]
                ? "Te enviamos un código a tu correo."
                : "Código generado, pero no se pudo enviar el correo.",
            "correo" => $usuario["correo"],
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

function verificarOtp($pdo, $input) {
    $correo = trim($input["correo"] ?? "");
    $codigo = trim($input["codigo"] ?? "");

    if ($correo === "" || $codigo === "") {
        responder([
            "ok" => false,
            "mensaje" => "Correo y código son obligatorios."
        ], 400);
    }

    try {
        $otp = obtenerOtpValido($pdo, $correo, $codigo);

        if (!$otp) {
            responder([
                "ok" => false,
                "mensaje" => "Código incorrecto, vencido o ya usado."
            ], 400);
        }

        responder([
            "ok" => true,
            "mensaje" => "Código verificado correctamente.",
            "correo" => $correo
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => "Error verificando código: " . $error->getMessage()
        ], 500);
    }
}

function cambiarPassword($pdo, $input) {
    $correo = trim($input["correo"] ?? "");
    $codigo = trim($input["codigo"] ?? "");
    $nuevaClave = trim($input["nueva_clave"] ?? "");
    $confirmarClave = trim($input["confirmar_clave"] ?? "");

    if ($correo === "" || $codigo === "" || $nuevaClave === "" || $confirmarClave === "") {
        responder([
            "ok" => false,
            "mensaje" => "Completa todos los campos."
        ], 400);
    }

    if ($nuevaClave !== $confirmarClave) {
        responder([
            "ok" => false,
            "mensaje" => "Las contraseñas no coinciden."
        ], 400);
    }

    if (strlen($nuevaClave) < 6) {
        responder([
            "ok" => false,
            "mensaje" => "La contraseña debe tener mínimo 6 caracteres."
        ], 400);
    }

    try {
        $pdo->beginTransaction();

        $otp = obtenerOtpValido($pdo, $correo, $codigo, true);

        if (!$otp) {
            $pdo->rollBack();

            responder([
                "ok" => false,
                "mensaje" => "Código incorrecto, vencido o ya usado."
            ], 400);
        }

        $stmtUpdate = $pdo->prepare("
            UPDATE Usuarios
            SET clave = :clave
            WHERE id_usuario = :id_usuario
            LIMIT 1
        ");

        $stmtUpdate->execute([
            ":clave" => $nuevaClave,
            ":id_usuario" => $otp["id_usuario"]
        ]);

        $stmtUsado = $pdo->prepare("
            UPDATE PasswordResetOtps
            SET usado = 1
            WHERE id_otp = :id_otp
            LIMIT 1
        ");

        $stmtUsado->execute([
            ":id_otp" => $otp["id_otp"]
        ]);

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Contraseña actualizada correctamente. Ya puedes iniciar sesión."
        ]);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error cambiando contraseña: " . $error->getMessage()
        ], 500);
    }
}

function obtenerOtpValido($pdo, $correo, $codigo, $bloquear = false) {
    $sql = "
        SELECT
            o.id_otp,
            o.id_usuario,
            o.correo,
            o.codigo,
            o.fecha_expiracion,
            o.usado,
            o.intentos,
            u.estado
        FROM PasswordResetOtps o
        INNER JOIN Usuarios u
            ON u.id_usuario = o.id_usuario
        WHERE o.correo = :correo
          AND o.usado = 0
        ORDER BY o.id_otp DESC
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

    if ($otp["estado"] !== "activo") {
        return null;
    }

    if ((int) $otp["intentos"] >= 5) {
        return null;
    }

    if (strtotime($otp["fecha_expiracion"]) < time()) {
        return null;
    }

    if ((string) $otp["codigo"] !== (string) $codigo) {
        aumentarIntentosOtp($pdo, $otp["id_otp"]);
        return null;
    }

    return $otp;
}

function aumentarIntentosOtp($pdo, $idOtp) {
    $stmt = $pdo->prepare("
        UPDATE PasswordResetOtps
        SET intentos = intentos + 1
        WHERE id_otp = :id_otp
        LIMIT 1
    ");

    $stmt->execute([
        ":id_otp" => $idOtp
    ]);
}

function enviarCorreoOtp($correo, $nombre, $codigo) {
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
        $mail->addAddress($correo, $nombre ?: $correo);

        $mail->isHTML(true);
        $mail->Subject = "Código para recuperar tu contraseña - Store Super Joven";

        $mail->Body = "
            <div style='font-family: Arial, sans-serif; color: #111827;'>
                <h2 style='color:#22c55e;'>Recuperación de contraseña</h2>

                <p>Hola <strong>" . htmlspecialchars($nombre ?: "usuario") . "</strong>,</p>

                <p>Tu código para recuperar la contraseña es:</p>

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

                <p>Si no solicitaste este cambio, ignora este correo.</p>

                <hr style='border:none;border-top:1px solid #e5e7eb;margin:24px 0;'>

                <p style='color:#6b7280;font-size:13px;'>
                    Store Super Joven
                </p>
            </div>
        ";

        $mail->AltBody = "Tu código para recuperar la contraseña es: {$codigo}. Este código vence en 10 minutos.";

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
